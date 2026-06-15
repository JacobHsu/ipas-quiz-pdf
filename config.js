// Static configuration for the quiz app.
// Loaded before index.html's main script; variables here are script-scope globals
// shared with the inline script (classic scripts, not modules).

const STORAGE_KEY = "test-prep-rounds-v1";

// Spaced-repetition boost: each unresolved wrong adds WRONG_BOOST to a question's pick weight.
// Wrong once → weight 5; wrong twice → weight 9. A later correct answer resolves the entry.
const WRONG_BOOST = 4;

// Subject code → JSON path. Questions are loaded in parallel on boot so the HTML
// stays small and each subject file is independently cacheable and diffable.
const POOL_SOURCES = {
  s1: "subjects/1-ai/questions.json",
  s2: "subjects/2-bigdata/questions.json",
  s3: "subjects/3-ml/questions.json",
  e1: "subjects/entry-1-ai/questions.json",
  e2: "subjects/entry-2-genai/questions.json"
};

// Resolve truncated/legacy source filenames to actual relative paths from quiz.html.
// Subject 1 was parsed first with truncated names; subjects 2/3 use full paths.
const SOURCE_PDF_MAP = {};  // All source.file values are now clean ASCII paths; map kept for future legacy fallbacks

const LEVELS = {
  intermediate: "中級",
  entry: "初級"
};

// Subject metadata. All PDF paths are relative to index.html.
const SUBJECTS = {
  s1: {
    level: "intermediate",
    short: "科目一 · AI 技術應用與規劃",
    long: "iPAS AI 應用規劃師中級 科目一 人工智慧技術應用與規劃",
    study_guide: "subjects/1-ai/study-guide.pdf"
  },
  s2: {
    level: "intermediate",
    short: "科目二 · 大數據處理分析與應用",
    long: "iPAS AI 應用規劃師中級 科目二 大數據處理分析與應用",
    study_guide: "subjects/2-bigdata/study-guide.pdf"
  },
  s3: {
    level: "intermediate",
    short: "科目三 · 機器學習技術與應用",
    long: "iPAS AI 應用規劃師中級 科目三 機器學習技術與應用",
    study_guide: "subjects/3-ml/study-guide.pdf"
  },
  e1: {
    level: "entry",
    short: "初級科目一 · AI 基礎概論",
    long: "iPAS AI 應用規劃師初級 科目一 人工智慧基礎概論",
    study_guide: "subjects/entry-1-ai/study-guide.pdf"
  },
  e2: {
    level: "entry",
    short: "初級科目二 · 生成式 AI 應用與規劃",
    long: "iPAS AI 應用規劃師初級 科目二 生成式 AI 應用與規劃",
    study_guide: "subjects/entry-2-genai/study-guide.pdf"
  }
};

// Topic → study guide reference, nested by subject. s1 has detailed page mappings;
// s2/s3 and entry-level subjects use chapter-level fallbacks (click and search inside the PDF).
const TOPIC_REFS = {
  s1: {
    "AI/Definition":      { chapter: "Ch3 AI 相關技術應用", section: "導論", local: "3-1", pdf: 8 },
    "NLP/Sentiment":      { chapter: "Ch3.1 自然語言處理", section: "NLP 應用情境 (情感分析)", local: "3-3 起", pdf: 10 },
    "NLP/Tokenization":   { chapter: "Ch3.1 自然語言處理", section: "3. NLP 前處理 / 分詞 / TF-IDF", local: "3-9 至 3-12", pdf: 16 },
    "NLP/Embedding":      { chapter: "Ch3.1 自然語言處理", section: "4. NLP 關鍵技術 / 詞嵌入 (Word2Vec / GloVe)", local: "3-12 至 3-15", pdf: 19 },
    "NLP/Transformer":    { chapter: "Ch3.1 自然語言處理", section: "技術演進 D. 預訓練語言模型 / Transformer", local: "3-7 至 3-9", pdf: 14 },
    "NLP/RAG":            { chapter: "Ch3.1 / Ch3.3", section: "檢索增強生成 (RAG)", local: "3-22 起", pdf: 29 },
    "CV/Classification":  { chapter: "Ch3.2 電腦視覺", section: "影像分類", local: "3-40 起", pdf: 47 },
    "CV/Detection":       { chapter: "Ch3.2 電腦視覺", section: "物件偵測 / IoU / mAP", local: "3-43 起", pdf: 50 },
    "CV/Segmentation":    { chapter: "Ch3.2 電腦視覺", section: "語義 / 實例 / 全景分割", local: "3-46 起", pdf: 53 },
    "GenAI/GAN":          { chapter: "Ch3.3 生成式 AI", section: "GAN / VAE / Diffusion (Mode Collapse / WGAN)", local: "3-59 起", pdf: 66 },
    "GenAI/Compression":  { chapter: "Ch3.3 / Ch5", section: "模型壓縮 (量化 / 剪枝 / 蒸餾)", local: "3-63 起", pdf: 70 },
    "Multimodal":         { chapter: "Ch3.4 多模態人工智慧", section: "跨模態整合 / 早期融合 / 缺失模態", local: "3-73 起", pdf: 80 },
    "ML/Regression":      { chapter: "Ch5.1 數據準備與模型選擇", section: "迴歸 / 多重共線性 (PCA / LASSO)", local: "5-2 起", pdf: 135 },
    "ML/Classification":  { chapter: "Ch5.1 數據準備與模型選擇", section: "分類模型選擇 (CNN / RNN)", local: "5-2 起", pdf: 135 },
    "ML/Clustering":      { chapter: "Ch5.1 數據準備與模型選擇", section: "分群 (K-Means / DBSCAN)", local: "5-5 起", pdf: 138 },
    "ML/Evaluation":      { chapter: "Ch5.1 數據準備與模型選擇", section: "評估指標 (Precision / Recall / F1 / mAP / CV)", local: "5-7 起", pdf: 140 },
    "ML/Overfitting":     { chapter: "Ch5.1 / Ch4.3", section: "過擬合與正則化 (CV / Early Stopping / PCA)", local: "5-5 起", pdf: 138 },
    "Data/Preprocessing": { chapter: "Ch5.1 數據準備與模型選擇", section: "數據前處理 (Standardization / Encoding)", local: "5-2 起", pdf: 134 },
    "Data/Augmentation":  { chapter: "Ch5.1 數據準備", section: "資料增強 (Data Augmentation)", local: "5-3 起", pdf: 136 },
    "Data/Drift":         { chapter: "Ch5.2 / Ch4.3", section: "資料漂移偵測 (KL Divergence / PSI)", local: "5-14 起 / 4-29 起", pdf: 145 },
    "Deploy/MLOps":       { chapter: "Ch5.2 系統集成與部署", section: "MLOps / Model Registry / CI", local: "5-14 起", pdf: 145 },
    "Deploy/Kubernetes":  { chapter: "Ch5.2 系統集成與部署", section: "容器化與 K8s 編排 / 水平擴展", local: "5-17 起", pdf: 148 },
    "Deploy/Integration": { chapter: "Ch5.2 系統集成與部署", section: "系統整合測試 / 漸進式部署", local: "5-19 起", pdf: 150 },
    "Risk/Security":      { chapter: "Ch4.3 AI 風險管理", section: "對抗性攻擊 / 供應鏈安全 / 不可否認性", local: "4-29 起", pdf: 116 },
    "Risk/Privacy":       { chapter: "Ch4.3 AI 風險管理", section: "資料隱私 / 偏見與公平性", local: "4-31 起", pdf: 118 },
    "Risk/Copyright":     { chapter: "Ch4.3 AI 風險管理", section: "生成式 AI 與著作權", local: "4-33 起", pdf: 120 }
  },
  s2: {
    "Stats/Descriptive":  { chapter: "Ch3 機率統計基礎", section: "敘述性統計與資料摘要技術 / t / F / 卡方檢定", local: "見學習指引", pdf: 1 },
    "Stats/Hypothesis":   { chapter: "Ch3 機率統計基礎", section: "假設檢定與統計推論", local: "見學習指引", pdf: 1 },
    "Stats/Probability":  { chapter: "Ch3 機率統計基礎", section: "機率分佈與資料分佈模型", local: "見學習指引", pdf: 1 },
    "Stats/Regression":   { chapter: "Ch3 機率統計基礎", section: "相關 / 簡單線性迴歸", local: "見學習指引", pdf: 1 },
    "BigData/Collection": { chapter: "Ch4 大數據處理技術", section: "數據收集與清理", local: "見學習指引", pdf: 1 },
    "BigData/Storage":    { chapter: "Ch4 大數據處理技術", section: "數據儲存與管理 (HDFS / NoSQL)", local: "見學習指引", pdf: 1 },
    "BigData/Processing": { chapter: "Ch4 大數據處理技術", section: "數據處理技術 (Hadoop / Spark)", local: "見學習指引", pdf: 1 },
    "BigData/Cleaning":   { chapter: "Ch4 大數據處理技術", section: "數據清理 / 缺失值 / 異常值", local: "見學習指引", pdf: 1 },
    "Analytics/EDA":      { chapter: "Ch5 大數據分析方法與工具", section: "探索式分析 (EDA) / 統計學在大數據中的應用", local: "見學習指引", pdf: 1 },
    "Analytics/Methods":  { chapter: "Ch5 大數據分析方法與工具", section: "常見的大數據分析方法 (分群 / 分類 / 迴歸)", local: "見學習指引", pdf: 1 },
    "Viz/Tools":          { chapter: "Ch5 大數據分析方法與工具", section: "數據可視化工具", local: "見學習指引", pdf: 1 },
    "FeatureEng":         { chapter: "Ch6 大數據在 AI 之應用", section: "特徵工程 / 特徵選擇 / 降維", local: "見學習指引", pdf: 1 },
    "ML/Basics":          { chapter: "Ch6 大數據在 AI 之應用", section: "大數據與機器學習 / 鑑別式 / 生成式 AI", local: "見學習指引", pdf: 1 },
    "ROC/AUC":            { chapter: "Ch5 / Ch6", section: "模型評估 (ROC / AUC)", local: "見學習指引", pdf: 1 },
    "Privacy":            { chapter: "Ch6 大數據在 AI 之應用", section: "大數據隱私保護 / 安全與合規", local: "見學習指引", pdf: 1 },
    "Security/Compliance":{ chapter: "Ch6 大數據在 AI 之應用", section: "資料安全 / 稽核 / 合規", local: "見學習指引", pdf: 1 }
  },
  s3: {
    "Math/Probability":   { chapter: "Ch3 機器學習基礎數學", section: "機率 / 統計", local: "見學習指引", pdf: 1 },
    "Math/LinAlg":        { chapter: "Ch3 機器學習基礎數學", section: "線性代數", local: "見學習指引", pdf: 1 },
    "Math/Optimization":  { chapter: "Ch3 機器學習基礎數學", section: "數值優化 (梯度下降 / 學習率)", local: "見學習指引", pdf: 1 },
    "ML/Supervised":      { chapter: "Ch4 機器學習與深度學習", section: "監督式學習原理", local: "見學習指引", pdf: 1 },
    "ML/Unsupervised":    { chapter: "Ch4 機器學習與深度學習", section: "非監督式學習", local: "見學習指引", pdf: 1 },
    "ML/Algorithms":      { chapter: "Ch4 機器學習與深度學習", section: "常見演算法 (SVM / RF / KNN)", local: "見學習指引", pdf: 1 },
    "DL/Basics":          { chapter: "Ch4 機器學習與深度學習", section: "深度學習原理與框架", local: "見學習指引", pdf: 1 },
    "DL/CNN":             { chapter: "Ch4 機器學習與深度學習", section: "CNN (卷積神經網路)", local: "見學習指引", pdf: 1 },
    "DL/RNN":             { chapter: "Ch4 機器學習與深度學習", section: "RNN / LSTM / GRU", local: "見學習指引", pdf: 1 },
    "DL/Transformer":     { chapter: "Ch4 機器學習與深度學習", section: "Transformer / Attention", local: "見學習指引", pdf: 1 },
    "DL/Optimization":    { chapter: "Ch4 機器學習與深度學習", section: "Adam / Dropout / BatchNorm", local: "見學習指引", pdf: 1 },
    "Feature/Engineering":{ chapter: "Ch5 機器學習建模與參數調校", section: "數據準備與特徵工程", local: "見學習指引", pdf: 1 },
    "Feature/Selection":  { chapter: "Ch5 機器學習建模與參數調校", section: "特徵選擇 / 降維", local: "見學習指引", pdf: 1 },
    "Modeling/Selection": { chapter: "Ch5 機器學習建模與參數調校", section: "模型選擇與架構設計", local: "見學習指引", pdf: 1 },
    "Training/Validation":{ chapter: "Ch5 機器學習建模與參數調校", section: "模型訓練、評估與驗證 (CV / Holdout)", local: "見學習指引", pdf: 1 },
    "Training/Tuning":    { chapter: "Ch5 機器學習建模與參數調校", section: "超參數調校 (Grid / Random / Bayes)", local: "見學習指引", pdf: 1 },
    "Eval/Metrics":       { chapter: "Ch5 機器學習建模與參數調校", section: "評估指標 (Precision / Recall / F1 / AUC)", local: "見學習指引", pdf: 1 },
    "Eval/Bias":          { chapter: "Ch5 機器學習建模與參數調校", section: "偏差 / 方差 / Bias-Variance Tradeoff", local: "見學習指引", pdf: 1 },
    "Privacy/Compliance": { chapter: "Ch6 機器學習治理", section: "數據隱私 / 安全與合規", local: "見學習指引", pdf: 1 },
    "Bias/Fairness":      { chapter: "Ch6 機器學習治理", section: "演算法偏見與公平性", local: "見學習指引", pdf: 1 }

  },
  e1: {
    "AI/Definition":     { chapter: "Ch3.1 人工智慧概念", section: "AI 定義、應用與核心能力", local: "3-1 起", pdf: 8 },
    "Data/BigData":      { chapter: "Ch3.2 資料處理與分析概念", section: "大數據特性與資料處理", local: "3-24 起", pdf: 31 },
    "Data/Analytics":    { chapter: "Ch3.2 資料處理與分析概念", section: "描述/診斷/預測/處方分析", local: "3-24 起", pdf: 31 },
    "ML/Supervised":     { chapter: "Ch3.3 機器學習概念", section: "監督式學習", local: "3-33 起", pdf: 40 },
    "ML/Unsupervised":   { chapter: "Ch3.3 機器學習概念", section: "非監督式學習", local: "3-33 起", pdf: 40 },
    "ML/Reinforcement":  { chapter: "Ch3.3 機器學習概念", section: "強化學習", local: "3-33 起", pdf: 40 },
    "ML/Evaluation":     { chapter: "Ch3.3 機器學習概念", section: "模型評估", local: "3-33 起", pdf: 40 },
    "DeepLearning":      { chapter: "Ch3.3 機器學習概念", section: "深度學習", local: "3-33 起", pdf: 40 },
    "NLP":               { chapter: "Ch3.1 人工智慧概念", section: "自然語言處理", local: "3-1 起", pdf: 8 },
    "CV":                { chapter: "Ch3.1 人工智慧概念", section: "電腦視覺", local: "3-1 起", pdf: 8 },
    "GenAI/RAG":         { chapter: "Ch3.4 鑑別式 AI 與生成式 AI 概念", section: "生成式 AI / RAG / Fine-tuning", local: "3-48 起", pdf: 55 },
    "AI/Ethics":         { chapter: "Ch3.1 / Ch3.4", section: "AI 倫理、透明、公平、問責", local: "見學習指引", pdf: 61 },
    "AI/Security":       { chapter: "Ch3.4", section: "AI 安全與風險", local: "見學習指引", pdf: 64 },
    "AI/Privacy":        { chapter: "Ch3.4", section: "個資與隱私", local: "見學習指引", pdf: 66 },
    "AI/Governance":     { chapter: "Ch3.4", section: "AI 導入治理", local: "見學習指引", pdf: 68 }
  },
  e2: {
    "LowCode/NoCode":    { chapter: "Ch3.1 No code / Low code 概念", section: "平台能力與限制", local: "3-1 起", pdf: 8 },
    "Workflow/Automation": { chapter: "Ch3.1 No code / Low code 概念", section: "自動化流程元件", local: "3-1 起", pdf: 12 },
    "API/Tokens":        { chapter: "Ch3.2 生成式 AI 應用領域與工具使用", section: "API / Token / 模型參數", local: "3-17 起", pdf: 24 },
    "Prompt/Engineering": { chapter: "Ch3.2 生成式 AI 應用領域與工具使用", section: "提示工程", local: "3-17 起", pdf: 20 },
    "RAG/Knowledge":     { chapter: "Ch3.2 生成式 AI 應用領域與工具使用", section: "RAG / 知識庫 / 向量檢索", local: "3-17 起", pdf: 24 },
    "Model/FineTuning":  { chapter: "Ch3.2 / Ch3.3", section: "微調與知識更新", local: "見學習指引", pdf: 30 },
    "Agents/Tools":      { chapter: "Ch3.2", section: "AI Agent 與工具呼叫", local: "見學習指引", pdf: 34 },
    "GenAI/Applications": { chapter: "Ch3.2 生成式 AI 應用領域與工具使用", section: "生成式 AI 應用情境", local: "3-17 起", pdf: 38 },
    "AI/Governance":     { chapter: "Ch3.3 生成式 AI 導入評估規劃", section: "治理、黑箱、責任與風險", local: "3-31 起", pdf: 42 },
    "AI/PrivacySecurity": { chapter: "Ch3.3 生成式 AI 導入評估規劃", section: "隱私、資安與敏感資訊", local: "3-31 起", pdf: 46 },
    "Project/Planning":  { chapter: "Ch3.3 生成式 AI 導入評估規劃", section: "導入評估與維運監控", local: "3-31 起", pdf: 52 },
    "AI/Copyright":      { chapter: "Ch3.3 生成式 AI 導入評估規劃", section: "著作權與合規", local: "3-31 起", pdf: 58 }
  }
};
