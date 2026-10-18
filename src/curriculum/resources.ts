import { ResourceLink } from '../types';

export const CURRICULUM_RESOURCES: Record<string, ResourceLink> = {
  pythonTutorial: {
    title: 'Official Python Documentation & Tutorial',
    url: 'https://docs.python.org/3/tutorial/',
    type: 'Doc',
    description: 'Comprehensive official guide to Python syntax, data structures, and functions.',
    whyRecommended: 'Foundational reference for writing clean Python code.'
  },
  banditWargame: {
    title: 'OverTheWire: Bandit Wargame (Linux CLI)',
    url: 'https://overthewire.org/wargames/bandit/',
    type: 'Practice',
    description: 'Interactive hands-on challenge for mastering Linux terminal commands and file permissions.',
    whyRecommended: 'The gold standard for learning real Linux CLI navigation and security.'
  },
  sqlBolt: {
    title: 'SQLBolt: Interactive SQL Lessons & Exercises',
    url: 'https://sqlbolt.com/',
    type: 'Practice',
    description: 'Interactive browser-based SQL tutorial with immediate query execution.',
    whyRecommended: 'Best interactive playground for mastering SQL queries and aggregations.'
  },
  wiresharkGuide: {
    title: 'Wireshark User Guide & Network Analysis',
    url: 'https://www.wireshark.org/docs/wsug_html_chunked/',
    type: 'Doc',
    description: 'Official guide for capturing and inspecting network packet captures (pcap).',
    whyRecommended: 'Essential tool for network engineering and packet analysis.'
  },
  numpyQuickstart: {
    title: 'NumPy Quickstart & Array Operations',
    url: 'https://numpy.org/doc/stable/user/quickstart.html',
    type: 'Doc',
    description: 'Official guide for vectorization, array slicing, and high-performance matrix math.',
    whyRecommended: 'Core library for numerical compute in Python.'
  },
  scikitLearn: {
    title: 'Scikit-Learn Machine Learning in Python',
    url: 'https://scikit-learn.org/stable/tutorial/index.html',
    type: 'Doc',
    description: 'Official tutorials covering supervised learning, classification, regression, and decision trees.',
    whyRecommended: 'The standard Python library for classical machine learning.'
  },
  owaspTop10: {
    title: 'OWASP Top 10 Web Application Security',
    url: 'https://owasp.org/www-project-top-ten/',
    type: 'Doc',
    description: 'Industry standard awareness document for web application security risks (SQLi, XSS).',
    whyRecommended: 'Crucial reference for web security penetration testing.'
  },
  pandasGuide: {
    title: 'Pandas User Guide & Data Manipulation',
    url: 'https://pandas.pydata.org/docs/user_guide/index.html',
    type: 'Doc',
    description: 'Official guide for DataFrames, indexing, groupings, and series manipulation.',
    whyRecommended: 'Core library for tabular data analytics in Python.'
  },
  pytorchTutorials: {
    title: 'PyTorch Deep Learning Tutorials',
    url: 'https://pytorch.org/tutorials/',
    type: 'Doc',
    description: 'Official deep learning workflows covering tensors, autograd, and neural modules.',
    whyRecommended: 'Modern framework for deep neural network research and deployment.'
  },
  bloodHoundWiki: {
    title: 'BloodHound Active Directory Attack Path Analysis',
    url: 'https://bloodhound.readthedocs.io/en/latest/',
    type: 'Doc',
    description: 'Official documentation for graph-based Active Directory security auditing.',
    whyRecommended: 'Industry standard tool for Active Directory red teaming and audit.'
  },
  sparkDocs: {
    title: 'Apache Spark Structured Streaming & DataFrames',
    url: 'https://spark.apache.org/docs/latest/sql-programming-guide.html',
    type: 'Doc',
    description: 'Official Apache Spark guide for scalable distributed data processing.',
    whyRecommended: 'The enterprise standard for big data pipeline processing.'
  },
  huggingFaceNLP: {
    title: 'Hugging Face Transformers Course',
    url: 'https://huggingface.co/learn/nlp-course/',
    type: 'Course',
    description: 'Comprehensive course on Transformer architectures, tokenizers, and LLM fine-tuning.',
    whyRecommended: 'The premier open-source NLP ecosystem reference.'
  }
};
