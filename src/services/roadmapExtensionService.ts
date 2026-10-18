import { MentorDomain, StageRoadmap } from '../types';
import { DailyMissionDefinition } from '../curriculum/types';
import { CURRICULUM_RESOURCES } from '../curriculum/resources';

export interface ExtensionContext {
  domain: MentorDomain;
  startDay: number; // e.g. 91
  endDay: number; // e.g. 100
  baseStages: StageRoadmap[];
  requestedFocus?: string;
  userGoal?: string;
}

export class RoadmapExtensionService {
  /**
   * Generates deterministic extended days (e.g. Days 91–100, 61–75, 101–110)
   * seamlessly continuing from previous days' competencies and themes.
   */
  static generateExtensionMissions(context: ExtensionContext): DailyMissionDefinition[] {
    const { domain, startDay, endDay, requestedFocus, userGoal } = context;
    const missions: DailyMissionDefinition[] = [];

    const isAI = domain === 'AI_ML';
    const isCyber = domain === 'CYBERSECURITY';
    const cleanFocus = (requestedFocus || 'GENERAL').toUpperCase();

    for (let day = startDay; day <= endDay; day++) {
      let title = `Day ${day} — Specialized Mastery Milestone`;
      let learnTopic = `${domain.replace('_', '/')} Advanced Specialization`;
      let goal = `Extend core competency into advanced enterprise specialization (${cleanFocus}).`;
      let practiceTask = `Complete hands-on specialization laboratory for Day ${day}.`;
      let buildProject = `Build production-grade extension module for Day ${day}.`;
      let resources = [
        isAI
          ? CURRICULUM_RESOURCES.huggingFaceNLP
          : isCyber
          ? CURRICULUM_RESOURCES.owaspTop10
          : CURRICULUM_RESOURCES.sparkDocs
      ];

      if (isAI) {
        if (day === 91) {
          title = 'Day 91 — Multi-Modal Model Architectures (Vision-Language Models)';
          learnTopic = 'Vision-Language Alignments & CLIP / LLaVA';
          goal = 'Understand cross-attention between vision encoders (ViT) and autoregressive language decoders.';
          practiceTask = 'Extract image embeddings using CLIP and compute cosine similarity with text prompts.';
          buildProject = 'Build multi-modal image semantic search and retrieval CLI.';
        } else if (day === 92) {
          title = 'Day 92 — Vision-Language Fine-Tuning with QLoRA';
          learnTopic = 'VLM Parameter-Efficient Fine-Tuning';
          goal = 'Fine-tune open-weight multimodal model for document VQA (Visual Question Answering).';
          practiceTask = 'Prepare image-text question answering dataset and configure LoRA adapters.';
          buildProject = 'Build multimodal invoice and document data extraction model.';
        } else if (day === 93) {
          title = 'Day 93 — Speculative Decoding & Advanced LLM Inference Acceleration';
          learnTopic = 'Inference Acceleration & Speculative Sampling';
          goal = 'Accelerate generation latency using draft models and verification passes.';
          practiceTask = 'Implement speculative decoding benchmark comparing latency and acceptance rate.';
          buildProject = 'Build speculative decoding acceleration module.';
        } else if (day === 94) {
          title = 'Day 94 — Synthetic Data Generation & Data Distillation Pipelines';
          learnTopic = 'Curated Synthetic Pretraining Data';
          goal = 'Filter, rephrase, and verify synthetic training corpora using teacher models.';
          practiceTask = 'Generate and quality-score 5,000 synthetic instruction pairs.';
          buildProject = 'Build synthetic instruction generation and de-duplication pipeline.';
        } else if (day === 95) {
          title = 'Day 95 — Model Merging & Task Vectors (TIES-Merging / DARE)';
          learnTopic = 'Weight Merging & Task Arithmetic';
          goal = 'Combine multiple specialized LoRA checkpoints into a single unified foundation model.';
          practiceTask = 'Merge coding and math checkpoints using spherical linear interpolation (SLERP).';
          buildProject = 'Build automated model checkpoint merger tool.';
        } else if (day === 96) {
          title = 'Day 96 — Advanced Agentic Planning: Tree-of-Thoughts & MCTS';
          learnTopic = 'Monte Carlo Tree Search & Heuristic Search in LLMs';
          goal = 'Implement tree-of-thought exploration algorithms for complex multi-step reasoning.';
          practiceTask = 'Implement MCTS state evaluation for symbolic logic problems.';
          buildProject = 'Build tree-of-thoughts theorem prover and logic solver.';
        } else if (day === 97) {
          title = 'Day 97 — Autonomous Tool Use & Environment Sandboxing';
          learnTopic = 'Secure Sandbox Execution for AI Agents';
          goal = 'Execute generated code in isolated Docker/WASM sandboxes with resource limits.';
          practiceTask = 'Build Docker-in-Docker ephemeral execution container with strict CPU/memory timeouts.';
          buildProject = 'Build secure agent sandbox execution environment.';
        } else if (day === 98) {
          title = 'Day 98 — Long-Context Management & KV-Cache Compression (StreamingLLM)';
          learnTopic = 'Attention Sink Mechanics & Dynamic KV-Cache Eviction';
          goal = 'Maintain stable generation across 1M+ token conversations without GPU OOM crashes.';
          practiceTask = 'Implement attention sink sliding window KV-cache manager in PyTorch.';
          buildProject = 'Build infinite-context streaming chat server.';
        } else if (day === 99) {
          title = 'Day 99 — Enterprise Model Observability, Tracing & Cost Telemetry';
          learnTopic = 'OpenTelemetry for AI & Token Cost Auditing';
          goal = 'Instrument model calls with distributed trace IDs, latency percentiles (p99), and cost metrics.';
          practiceTask = 'Export OpenTelemetry spans for multi-agent tool calls and vector searches.';
          buildProject = 'Build real-time LLM cost and latency observability dashboard.';
        } else if (day === 100) {
          title = 'Day 100 — Master Specialization Capstone: Production Scaled AI Platform';
          learnTopic = 'End-to-End Enterprise AI Platform Capstone';
          goal = 'Deliver a production multi-modal, agentic, speculative-accelerated AI service.';
          practiceTask = 'Deploy fully integrated production AI platform with observability and load tests.';
          buildProject = 'Production Scaled AI Platform Master Capstone.';
        } else {
          title = `Day ${day} — Specialized AI Systems (Day ${day})`;
          learnTopic = `Advanced AI Engineering (Extension Day ${day})`;
          goal = `Master specialized deep learning technique for Day ${day}.`;
          practiceTask = `Complete specialized implementation for Day ${day}.`;
          buildProject = `Build production component for Day ${day}.`;
        }
      } else if (isCyber) {
        if (day === 91) {
          title = 'Day 91 — Hypervisor Security & Virtualization-Based Security (VBS)';
          learnTopic = 'Type-1/Type-2 Hypervisors & Nested Virtualization';
          goal = 'Understand hardware-assisted virtualization (Intel VT-x, AMD-V) and hypervisor escapes.';
          practiceTask = 'Inspect hypercall handling and VMCS structures in a custom test hypervisor.';
          buildProject = 'Build lightweight VT-x hypervisor diagnostic probe.';
        } else if (day === 92) {
          title = 'Day 92 — Hardware Security & Side-Channel Attacks (Spectre/Meltdown)';
          learnTopic = 'Speculative Execution & Microarchitectural Attacks';
          goal = 'Understand transient execution, cache timing attacks (Flush+Reload), and branch target buffers.';
          practiceTask = 'Demonstrate cache timing discrimination in userspace.';
          buildProject = 'Build CPU cache access latency benchmarking tool.';
        } else if (day === 93) {
          title = 'Day 93 — Firmware & UEFI Rootkits (Secure Boot Analysis)';
          learnTopic = 'UEFI Architecture & SPI Flash Vulnerabilities';
          goal = 'Analyze UEFI DXE drivers, NVRAM variables, and Secure Boot bypass vectors.';
          practiceTask = 'Decompile UEFI firmware image using UEFITool and audit for insecure variable calls.';
          buildProject = 'Build automated UEFI firmware image security analyzer.';
        } else if (day === 94) {
          title = 'Day 94 — Advanced Windows Kernel Pool Exploitation';
          learnTopic = 'Kernel Pool Feng-Shui & Low Fragmentation Heap';
          goal = 'Manipulate kernel pool allocations to achieve arbitrary read/write primitives in Ring 0.';
          practiceTask = 'Reconstruct Non-Paged Pool memory layout following heap spray.';
          buildProject = 'Build kernel pool corruption detector script.';
        } else if (day === 95) {
          title = 'Day 95 — Hardware Security Modules (HSM) & TPM 2.0 Security';
          learnTopic = 'Trusted Platform Modules & Platform Configuration Registers';
          goal = 'Audit PCR sealing, bitlocker TPM keys, and bus snooping defenses.';
          practiceTask = 'Sniff and decode unencrypted SPI TPM traffic in hardware simulation.';
          buildProject = 'Build PCR integrity validation and sealing tester.';
        } else if (day === 96) {
          title = 'Day 96 — Cellular & Radio Security: Software-Defined Radio (SDR)';
          learnTopic = 'SDR Fundamentals & Signal Processing with GNU Radio';
          goal = 'Capture, demodulate, and analyze RF transmissions across ISM bands.';
          practiceTask = 'Capture and decode 433MHz remote control signal using RTL-SDR.';
          buildProject = 'Build automated RF signal recorder and replay detector.';
        } else if (day === 97) {
          title = 'Day 97 — Automotive Security: CAN Bus Infiltration & Telematics';
          learnTopic = 'Controller Area Network (CAN) Protocol & OBD-II';
          goal = 'Audit CAN bus arbitration IDs, frame injection, and automotive gateways.';
          practiceTask = 'Simulate and inject speed spoofing packets into virtual CAN bus (vcan0).';
          buildProject = 'Build real-time CAN bus anomaly detection filter.';
        } else if (day === 98) {
          title = 'Day 98 — Modern Threat Hunting: Threat Intel Platforms & Sigma Rules';
          learnTopic = 'Detection Engineering & Sigma/YARA Rule Authoring';
          goal = 'Write high-fidelity Sigma rules detecting novel adversary techniques in enterprise telemetry.';
          practiceTask = 'Author and validate 3 Sigma rules against suspicious process creation telemetry.';
          buildProject = 'Build automated Sigma-to-Elastic/Splunk rule compiler pipeline.';
        } else if (day === 99) {
          title = 'Day 99 — Cyber Threat Intelligence (CTI) & Adversary Campaign Analysis';
          learnTopic = 'MITRE ATT&CK Mapping & Diamond Threat Modeling';
          goal = 'Attribute nation-state campaigns and extract tactical, operational, and strategic IoCs.';
          practiceTask = 'Deconstruct APT campaign report into structured STIX/TAXII threat feed.';
          buildProject = 'Build automated threat feed ingestion and correlation engine.';
        } else if (day === 100) {
          title = 'Day 100 — Master Specialization Capstone: Enterprise Red & Blue Team Simulation';
          learnTopic = 'Purple Team Adversary Emulation Capstone';
          goal = 'Deliver full-spectrum red team engagement combined with validated defensive detections.';
          practiceTask = 'Execute multi-tier attack chain and verify end-to-end detection engineering coverage.';
          buildProject = 'Full Purple Team Adversary Emulation Capstone Report.';
        } else {
          title = `Day ${day} — Specialized Security Engineering (Day ${day})`;
          learnTopic = `Advanced Security Specialization (Extension Day ${day})`;
          goal = `Master specialized offensive/defensive technique for Day ${day}.`;
          practiceTask = `Complete specialized security lab for Day ${day}.`;
          buildProject = `Build specialized security module for Day ${day}.`;
        }
      } else {
        // DATA_SCIENCE
        if (day === 91) {
          title = 'Day 91 — Distributed Graph Analytics with GraphX & Neo4j';
          learnTopic = 'Graph Processing & PageRank at Scale';
          goal = 'Compute connected components, PageRank, and community detection on multi-million node graphs.';
          practiceTask = 'Run distributed PageRank algorithm on Twitter follower graph in Spark GraphX.';
          buildProject = 'Build social network influential node ranking engine.';
        } else if (day === 92) {
          title = 'Day 92 — Vector Database Architecture & High-Dimensional Indexing (HNSW)';
          learnTopic = 'Vector Indexing: HNSW, IVFFlat & Quantization';
          goal = 'Understand Hierarchical Navigable Small World graphs and vector similarity at scale.';
          practiceTask = 'Benchmark QPS and recall tradeoffs between HNSW and IVFFlat in pgvector/Milvus.';
          buildProject = 'Build high-throughput vector search benchmarking engine.';
        } else if (day === 93) {
          title = 'Day 93 — Continuous Data Quality & Testing (Great Expectations / Soda)';
          learnTopic = 'Data Quality Contracts & Automated Assertions';
          goal = 'Enforce schema assertions, distribution checks, and null rate thresholds in CI/CD.';
          practiceTask = 'Author 10 Great Expectations suites validating daily production data batches.';
          buildProject = 'Build automated data quality gatekeeper webhook.';
        } else if (day === 94) {
          title = 'Day 94 — Geospatial Big Data Analytics (GeoPandas & H3 Spatial Index)';
          learnTopic = 'Uber H3 Hexagonal Hierarchical Spatial Index';
          goal = 'Partition, aggregate, and query millions of spatial coordinates using H3 indexes.';
          practiceTask = 'Convert GPS coordinates into H3 hexagons and aggregate spatial ride demand.';
          buildProject = 'Build real-time geospatial demand surge heatmapping engine.';
        } else if (day === 95) {
          title = 'Day 95 — Modern Data Stack Cost Governance (Snowflake / BigQuery FinOps)';
          learnTopic = 'Data Warehouse Cost Modeling & Query Optimization';
          goal = 'Audit partition pruning, clustering keys, and warehouse slot utilization to reduce cloud costs.';
          practiceTask = 'Identify top 5 most expensive queries from query execution history and optimize them.';
          buildProject = 'Build automated warehouse query cost audit tool.';
        } else if (day === 96) {
          title = 'Day 96 — Privacy-Preserving Analytics: Differential Privacy';
          learnTopic = 'Epsilon-Differential Privacy & Laplace/Gaussian Mechanisms';
          goal = 'Inject controlled noise into statistical aggregates to protect individual identity.';
          practiceTask = 'Implement differentially private mean and count queries in Python.';
          buildProject = 'Build privacy-preserving database querying proxy.';
        } else if (day === 97) {
          title = 'Day 97 — Causal Inference & Synthetic Controls for Data Science';
          learnTopic = 'Do-Calculus, Propensity Score Matching & Synthetic Controls';
          goal = 'Differentiate correlation from causation when randomized controlled trials are impossible.';
          practiceTask = 'Implement Synthetic Control Method in Python to measure policy intervention impact.';
          buildProject = 'Build automated causal policy impact assessment tool.';
        } else if (day === 98) {
          title = 'Day 98 — Multi-Cloud Data Mesh: Federated Governance & Data Products';
          learnTopic = 'Data Mesh Architecture & Domain-Driven Data Ownership';
          goal = 'Design self-serve data platforms with federated computational governance and data products.';
          practiceTask = 'Define data product OpenAPI contract and automated semantic access policy.';
          buildProject = 'Build data product catalog metadata synchronizer.';
        } else if (day === 99) {
          title = 'Day 99 — Real-Time ML Feature Pipelines with Flink & Feast';
          learnTopic = 'Low-Latency Streaming Feature Engineering';
          goal = 'Compute streaming window features in Flink and write directly to Feast online feature store.';
          practiceTask = 'Calculate 10-minute sliding window transaction velocity in Flink and update Redis.';
          buildProject = 'Build sub-10ms fraud detection real-time feature pipeline.';
        } else if (day === 100) {
          title = 'Day 100 — Master Specialization Capstone: Enterprise Real-Time Data & ML Platform';
          learnTopic = 'Enterprise Data & ML Platform Capstone';
          goal = 'Deliver end-to-end unified lakehouse, streaming analytics, and real-time feature platform.';
          practiceTask = 'Deploy fully integrated enterprise platform supporting batch and streaming workloads.';
          buildProject = 'Enterprise Production Data & ML Platform Master Capstone.';
        } else {
          title = `Day ${day} — Specialized Data Systems (Day ${day})`;
          learnTopic = `Advanced Data Science Specialization (Extension Day ${day})`;
          goal = `Master specialized data technique for Day ${day}.`;
          practiceTask = `Complete specialized analytics exercise for Day ${day}.`;
          buildProject = `Develop scalable component for Day ${day}.`;
        }
      }

      missions.push({
        id: `${domain.toLowerCase()}-day-${day}`,
        day,
        phase: 'SPECIALIZATION',
        title,
        goal,
        learnTopic,
        learningObjectives: [goal, `Deliver enterprise-grade implementation for ${learnTopic}`],
        recommendedResources: resources,
        practiceTask,
        buildProject,
        successCondition: 'Pass all validation criteria and demonstrate working code.',
        estimatedMinutes: 120,
        completed: false
      });
    }

    return missions;
  }
}
