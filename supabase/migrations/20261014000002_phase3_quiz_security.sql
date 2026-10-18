-- Migration: 20261014000002_phase3_quiz_security.sql
-- Phase 3: Contextual Quiz and Answer-Key Security
--
-- Goals:
-- 1. Block direct client INSERT/UPDATE on quiz_attempts (only server-side RPC can write)
-- 2. Block direct client INSERT/UPDATE on quizzes (only SECURITY DEFINER RPCs can write)
-- 3. Add is_curated column to quizzes so server-inserted quizzes cannot be overwritten
-- 4. Update get_quiz_for_user to mark its inserts as is_curated = TRUE
-- 5. Update upsert_quiz_questions to reject overwriting curated quizzes

-- =========================================================
-- STEP 1: Restrict quiz_attempts RLS
-- Only SELECT is allowed from client.
-- All writes go through submit_quiz_attempt SECURITY DEFINER RPC.
-- =========================================================
DROP POLICY IF EXISTS "Users access own quiz attempts" ON public.quiz_attempts;

CREATE POLICY "Users view own quiz attempts"
  ON public.quiz_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

-- =========================================================
-- STEP 2: Restrict quizzes RLS
-- Only SELECT is allowed from client.
-- All writes go through get_quiz_for_user / upsert_quiz_questions SECURITY DEFINER RPCs.
-- =========================================================
DROP POLICY IF EXISTS "Users access roadmap quizzes" ON public.quizzes;

CREATE POLICY "Users view roadmap quizzes"
  ON public.quizzes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = quizzes.roadmap_id AND r.user_id = auth.uid()
    )
  );

-- =========================================================
-- STEP 3: Add is_curated column to quizzes
-- Curated quizzes are those inserted by get_quiz_for_user (server-managed).
-- Client-generated quizzes (upsert_quiz_questions) have is_curated = FALSE.
-- =========================================================
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS is_curated BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================================================
-- STEP 4: Update get_quiz_for_user to mark its inserts as curated
-- Full replacement — marks is_curated = TRUE on INSERT.
-- Strip answer keys from client output (correctOptionIndex, explanation).
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_quiz_for_user(
  p_roadmap_id UUID,
  p_day_number INT,
  p_topic TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_roadmap_owner UUID;
  v_domain TEXT;
  v_level TEXT;
  v_quiz_id UUID;
  v_topic TEXT;
  v_questions JSONB;
  v_sanitized JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;

  IF p_roadmap_id IS NULL OR p_day_number IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters: p_roadmap_id and p_day_number are required';
  END IF;

  -- Verify roadmap belongs to authenticated user and grab domain & level
  SELECT user_id, domain, level INTO v_roadmap_owner, v_domain, v_level
  FROM public.roadmaps
  WHERE id = p_roadmap_id;

  IF v_roadmap_owner IS NULL OR v_roadmap_owner <> v_user_id THEN
    RAISE EXCEPTION 'Access denied: Roadmap belongs to another user';
  END IF;

  -- Check if quiz already generated for this roadmap and day_number
  SELECT id, topic, questions INTO v_quiz_id, v_topic, v_questions
  FROM public.quizzes
  WHERE roadmap_id = p_roadmap_id AND day_number = p_day_number;

  IF v_quiz_id IS NULL THEN
    -- Deterministic Day-Specific questions aligned with Day N objectives & resources
    IF v_domain = 'CYBERSECURITY' THEN
      IF p_day_number = 1 THEN
        v_questions := '[
          {"id": "q1", "question": "Which Linux command is used to change file access permissions?", "options": ["chown", "chmod", "chgrp", "ls -l"], "correctOptionIndex": 1, "explanation": "`chmod` (change mode) modifies permission bits in Linux."},
          {"id": "q2", "question": "What numeric code represents read, write, and execute permissions (rwx) for the file owner only?", "options": ["644", "755", "700", "777"], "correctOptionIndex": 2, "explanation": "7 (4+2+1) grants read, write, and execute to owner, while 00 removes all permissions for group and others."},
          {"id": "q3", "question": "Which command pattern searches for the string \"flag\" inside files in the Bandit wargame?", "options": ["find . -name flag", "grep \"flag\" *", "cat flag", "locate flag"], "correctOptionIndex": 1, "explanation": "`grep \"flag\" *` searches line-by-line within the directory contents for the pattern."}
        ]'::jsonb;
      ELSIF p_day_number = 2 THEN
        v_questions := '[
          {"id": "q1", "question": "Which layer of the OSI model does the TCP protocol operate at?", "options": ["Network Layer (Layer 3)", "Transport Layer (Layer 4)", "Data Link Layer (Layer 2)", "Application Layer (Layer 7)"], "correctOptionIndex": 1, "explanation": "TCP is a connection-oriented Transport Layer (Layer 4) protocol."},
          {"id": "q2", "question": "In Wireshark, which display filter isolates only HTTP GET and POST requests?", "options": ["http.request", "tcp.port == 80", "ip.addr == 192.168.1.1", "dns.flags.response == 0"], "correctOptionIndex": 0, "explanation": "`http.request` filters specifically for client HTTP request packets in Wireshark."},
          {"id": "q3", "question": "What is the three-way handshake sequence used to establish a reliable TCP connection?", "options": ["ACK, SYN, SYN-ACK", "SYN, SYN-ACK, ACK", "SYN, ACK, FIN", "PING, PONG, ACK"], "correctOptionIndex": 1, "explanation": "TCP connection establishment begins with SYN, followed by SYN-ACK from server, then client ACK."}
        ]'::jsonb;
      ELSIF p_day_number = 15 THEN
        v_questions := '[
          {"id": "q1", "question": "According to the OWASP Top 10, how should applications prevent SQL Injection?", "options": ["Client-side JavaScript regex", "Parameterized queries / Prepared statements", "Base64 encoding all inputs", "Disabling database error logging"], "correctOptionIndex": 1, "explanation": "Parameterized queries keep user input separate from executable SQL instructions."},
          {"id": "q2", "question": "What type of XSS executes when malicious script is permanently stored in a database and served to other users?", "options": ["Reflected XSS", "Stored / Persistent XSS", "DOM-based XSS", "Blind XSS"], "correctOptionIndex": 1, "explanation": "Stored XSS persists malicious code in data stores and triggers whenever users view that data."}
        ]'::jsonb;
      ELSIF p_day_number = 35 THEN
        v_questions := '[
          {"id": "q1", "question": "Which tool uses graph theory to reveal Active Directory privilege escalation paths and attack graphs?", "options": ["BloodHound", "Nmap", "Wireshark", "Metasploit"], "correctOptionIndex": 0, "explanation": "BloodHound analyzes Active Directory relationships as a graph to uncover attack paths to Domain Admin."}
        ]'::jsonb;
      END IF;

    ELSIF v_domain = 'AI_ML' THEN
      IF p_day_number = 1 THEN
        v_questions := '[
          {"id": "q1", "question": "Which built-in Python sequence type is mutable and ordered?", "options": ["Tuple", "Set", "List", "Frozenset"], "correctOptionIndex": 2, "explanation": "Lists are mutable, ordered sequences in Python."},
          {"id": "q2", "question": "What does the list comprehension `[x**2 for x in range(4)]` return?", "options": ["[1, 4, 9, 16]", "[0, 1, 4, 9]", "(0, 1, 4, 9)", "Generator object"], "correctOptionIndex": 1, "explanation": "`range(4)` generates 0, 1, 2, 3; squaring each gives [0, 1, 4, 9]."},
          {"id": "q3", "question": "What is the average time complexity of dictionary key lookups in Python?", "options": ["O(1)", "O(n)", "O(log n)", "O(n^2)"], "correctOptionIndex": 0, "explanation": "Python dictionaries use hash tables, achieving O(1) average time complexity."}
        ]'::jsonb;
      ELSIF p_day_number = 2 THEN
        v_questions := '[
          {"id": "q1", "question": "What is the primary performance advantage of NumPy ndarrays over standard Python lists?", "options": ["Continuous memory allocation and C-level vectorized operations", "Support for arbitrary mixed types", "Automatic GPU offloading by default", "Built-in web visualization"], "correctOptionIndex": 0, "explanation": "NumPy arrays store elements in contiguous memory blocks, eliminating Python interpreter loop overhead via vectorization."},
          {"id": "q2", "question": "In NumPy, what is the result shape of broadcasting an array of shape (3, 1) with shape (1, 4)?", "options": ["(3, 4)", "(4, 3)", "(3, 1)", "ValueError: shapes cannot be broadcast"], "correctOptionIndex": 0, "explanation": "Broadcasting rules expand singleton dimensions (1) to match (3, 4)."}
        ]'::jsonb;
      ELSIF p_day_number = 15 THEN
        v_questions := '[
          {"id": "q1", "question": "In Scikit-Learn, which ensemble method trains multiple decision trees independently on bootstrapped subsets?", "options": ["Random Forest", "Gradient Boosting", "AdaBoost", "Logistic Regression"], "correctOptionIndex": 0, "explanation": "Random Forest is a bagging ensemble that trains independent decision trees on bootstrap samples."},
          {"id": "q2", "question": "Which metric is best suited for evaluating a highly imbalanced binary classification dataset?", "options": ["Accuracy", "PR-AUC / F1-Score", "Mean Squared Error", "R-squared"], "correctOptionIndex": 1, "explanation": "Accuracy is misleading with imbalanced data; Precision-Recall AUC or F1-Score accurately captures minority class performance."}
        ]'::jsonb;
      ELSIF p_day_number = 35 THEN
        v_questions := '[
          {"id": "q1", "question": "In PyTorch, which method detaches gradient tracking during model evaluation and validation?", "options": ["torch.no_grad()", "model.train()", "optimizer.zero_grad()", "loss.backward()"], "correctOptionIndex": 0, "explanation": "`torch.no_grad()` disables autograd tracking to reduce memory and speed up inference."}
        ]'::jsonb;
      END IF;

    ELSE -- DATA_SCIENCE
      IF p_day_number = 1 THEN
        v_questions := '[
          {"id": "q1", "question": "Which SQL clause is executed first in the logical query processing order?", "options": ["SELECT", "FROM", "WHERE", "ORDER BY"], "correctOptionIndex": 1, "explanation": "SQL begins logical execution by identifying source tables in the `FROM` clause."},
          {"id": "q2", "question": "How do you filter aggregated group metrics in SQL?", "options": ["WHERE", "HAVING", "GROUP BY", "FILTER"], "correctOptionIndex": 1, "explanation": "`HAVING` filters results after `GROUP BY` aggregations are calculated."},
          {"id": "q3", "question": "Which SQL operator searches for pattern wildcards in strings?", "options": ["IN", "LIKE", "BETWEEN", "EXISTS"], "correctOptionIndex": 1, "explanation": "`LIKE` with `%` or `_` searches string patterns."}
        ]'::jsonb;
      ELSIF p_day_number = 2 THEN
        v_questions := '[
          {"id": "q1", "question": "Which JOIN returns all rows from the left table and matched rows from the right table?", "options": ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "CROSS JOIN"], "correctOptionIndex": 1, "explanation": "`LEFT JOIN` preserves all rows from the left table."},
          {"id": "q2", "question": "What is the difference between `RANK()` and `DENSE_RANK()` window functions?", "options": ["`RANK()` leaves gaps after ties; `DENSE_RANK()` does not", "`DENSE_RANK()` leaves gaps; `RANK()` does not", "`RANK()` only works with integers", "There is no difference"], "correctOptionIndex": 0, "explanation": "`RANK()` skips rank numbers following ties (e.g., 1, 2, 2, 4), while `DENSE_RANK()` maintains sequential numbers (1, 2, 2, 3)."}
        ]'::jsonb;
      ELSIF p_day_number = 15 THEN
        v_questions := '[
          {"id": "q1", "question": "In Seaborn, which chart is specifically designed to show distributions and quartile ranges across categories?", "options": ["Box Plot / Violin Plot", "Line Plot", "Heatmap", "Pair Plot"], "correctOptionIndex": 0, "explanation": "Box and violin plots show median, interquartile range (IQR), and distribution shapes."}
        ]'::jsonb;
      END IF;
    END IF;

    -- If no curated day-specific quiz exists for this day, return NULL so client can show explicit message
    IF v_questions IS NULL OR jsonb_array_length(v_questions) = 0 THEN
      RETURN jsonb_build_object(
        'id', NULL,
        'roadmap_id', p_roadmap_id,
        'day_number', p_day_number,
        'topic', COALESCE(p_topic, 'General Focus'),
        'questions', '[]'::jsonb,
        'message', 'No curated quiz available for Day ' || p_day_number || ' yet.'
      );
    END IF;

    -- Insert with is_curated = TRUE (server-owned — client cannot overwrite)
    INSERT INTO public.quizzes (roadmap_id, day_number, topic, questions, is_curated)
    VALUES (p_roadmap_id, p_day_number, COALESCE(p_topic, 'Day ' || p_day_number || ' Milestone'), v_questions, TRUE)
    ON CONFLICT (roadmap_id, day_number)
    DO UPDATE SET topic = EXCLUDED.topic
    RETURNING id, topic, questions INTO v_quiz_id, v_topic, v_questions;
  END IF;

  -- Strip correctOptionIndex and explanation from JSON for client display
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', elem->>'id',
      'question', elem->>'question',
      'options', elem->'options'
    )
  ) INTO v_sanitized
  FROM jsonb_array_elements(v_questions) AS elem;

  RETURN jsonb_build_object(
    'id', v_quiz_id,
    'roadmap_id', p_roadmap_id,
    'day_number', p_day_number,
    'topic', v_topic,
    'questions', COALESCE(v_sanitized, '[]'::jsonb)
  );
END;
$$;

-- =========================================================
-- STEP 5: Update upsert_quiz_questions to reject overwriting curated quizzes
-- If is_curated = TRUE, return existing sanitized questions — client cannot overwrite.
-- =========================================================
CREATE OR REPLACE FUNCTION public.upsert_quiz_questions(
  p_roadmap_id UUID,
  p_day_number INT,
  p_topic TEXT,
  p_questions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_roadmap_owner UUID;
  v_quiz_id UUID;
  v_is_curated BOOLEAN;
  v_existing_questions JSONB;
  v_sanitized JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;

  IF p_roadmap_id IS NULL OR p_day_number IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters: p_roadmap_id and p_day_number are required';
  END IF;

  -- Verify roadmap belongs to authenticated user
  SELECT user_id INTO v_roadmap_owner
  FROM public.roadmaps
  WHERE id = p_roadmap_id;

  IF v_roadmap_owner IS NULL OR v_roadmap_owner <> v_user_id THEN
    RAISE EXCEPTION 'Access denied: Roadmap belongs to another user';
  END IF;

  -- Check if a quiz already exists for this day
  SELECT id, questions, is_curated INTO v_quiz_id, v_existing_questions, v_is_curated
  FROM public.quizzes
  WHERE roadmap_id = p_roadmap_id AND day_number = p_day_number;

  IF v_quiz_id IS NOT NULL THEN
    -- Quiz already exists — curated or client-generated.
    -- Either way return sanitized existing questions; never overwrite existing content.
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', elem->>'id',
        'question', elem->>'question',
        'options', elem->'options'
      )
    ) INTO v_sanitized
    FROM jsonb_array_elements(v_existing_questions) AS elem;

    RETURN jsonb_build_object(
      'id', v_quiz_id,
      'roadmap_id', p_roadmap_id,
      'day_number', p_day_number,
      'topic', p_topic,
      'questions', COALESCE(v_sanitized, '[]'::jsonb),
      'source', CASE WHEN v_is_curated THEN 'curated' ELSE 'existing' END
    );
  END IF;

  -- No existing quiz — insert with is_curated = FALSE (client-generated content)
  INSERT INTO public.quizzes (roadmap_id, day_number, topic, questions, is_curated)
  VALUES (p_roadmap_id, p_day_number, COALESCE(p_topic, 'Day ' || p_day_number || ' Milestone'), p_questions, FALSE)
  ON CONFLICT (roadmap_id, day_number)
  DO UPDATE SET
    topic = EXCLUDED.topic,
    questions = EXCLUDED.questions
  WHERE quizzes.is_curated = FALSE  -- Only overwrite if not curated (race-condition guard)
  RETURNING id INTO v_quiz_id;

  -- If upsert was blocked (e.g. a curated row appeared via race condition), fetch existing
  IF v_quiz_id IS NULL THEN
    SELECT id, questions INTO v_quiz_id, v_existing_questions
    FROM public.quizzes
    WHERE roadmap_id = p_roadmap_id AND day_number = p_day_number;
  ELSE
    v_existing_questions := p_questions;
  END IF;

  -- Return sanitized version (strip correctOptionIndex and explanation)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', elem->>'id',
      'question', elem->>'question',
      'options', elem->'options'
    )
  ) INTO v_sanitized
  FROM jsonb_array_elements(v_existing_questions) AS elem;

  RETURN jsonb_build_object(
    'id', v_quiz_id,
    'roadmap_id', p_roadmap_id,
    'day_number', p_day_number,
    'topic', p_topic,
    'questions', COALESCE(v_sanitized, '[]'::jsonb),
    'source', 'generated'
  );
END;
$$;

-- Grant execute permissions (ownership checked inside functions via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.get_quiz_for_user(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_quiz_questions(UUID, INT, TEXT, JSONB) TO authenticated;
