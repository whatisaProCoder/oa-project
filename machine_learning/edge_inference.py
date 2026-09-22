import xgboost as xgb
import pandas as pd
import numpy as np
import os
from machine_learning.bm25_knowledge_base import search_index, build_index

try:
    from llama_cpp import Llama
except ImportError:
    print("Warning: llama-cpp-python not found. Falling back to dummy LLM.")
    Llama = None

# Global model instances for lazy loading
_xgb_model = None
_llm = None

def get_xgb_model():
    global _xgb_model
    if _xgb_model is None:
        model_path = os.path.join(os.path.dirname(__file__), "oa_risk_model.json")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"XGBoost model not found at {model_path}. Run train_xgboost.py first.")
        print("Loading XGBoost model...")
        _xgb_model = xgb.XGBClassifier()
        _xgb_model.load_model(model_path)
    return _xgb_model

def get_llm():
    global _llm
    if _llm is None and Llama is not None:
        model_path = os.path.join(os.path.dirname(__file__), "models", "qwen2.5-0.5b-instruct-q4_k_m.gguf")
        if not os.path.exists(model_path):
            print(f"Warning: LLM model not found at {model_path}. Please run download_model.py.")
            return None
        print(f"Loading local LLM from {model_path}...")
        _llm = Llama(
            model_path=model_path,
            n_ctx=1024,
            verbose=False,
            # Use small n_gpu_layers or leave as 0 for CPU-only Pi
        )
    return _llm

def dummy_llm_inference(prompt):
    """Simulates output if the real LLM is unavailable."""
    return "Based on the literature, asymmetric pressure and low EMG suggest joint instability. Recommend physical therapy for quadriceps strengthening and gait correction."

import threading

# Globals for async inference
_current_insight = "Waiting for initial sensor data..."
_llm_thread = None

def _generate_insight_task(risk_class_name, womac_score=None, language="English"):
    global _current_insight
    try:
        # 3. Information Retrieval (BM25)
        query = "high plantar pressure asymmetric loading reduced emg amplitude"
        relevant_docs = search_index(query, top_n=2)
        context = "\n".join([d['content'] for d in relevant_docs])
        
        # 4. LLM Generation
        llm = get_llm()
        
        system_prompt = (
            "You are a concise AI medical assistant assisting a healthcare worker with OA risk assessment. "
            "You are treating a patient in the North Eastern Region (NER) of India. "
            "Always include localized dietary advice such as traditional minimal-oil cooking (boiling/steaming), "
            "relying on local fermented foods (bamboo shoots, soybeans), fresh 'junglee' greens, and local ginger/garlic for anti-inflammation."
        )
        
        womac_text = ""
        if womac_score:
            womac_text = f"\nPatient WOMAC Survey - Pain: {womac_score.get('pain',0)}/10, Stiffness: {womac_score.get('stiffness',0)}/10, Function Loss: {womac_score.get('function',0)}/10."
            
        if language != "English":
            system_prompt += f" CRITICAL: You MUST translate your final response entirely into {language}. Do not use English unless explicitly asked."
            
        if llm:
            from typing import Any
            messages: Any = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context: {context}\n\nPatient Status: {risk_class_name}. Sensor anomalies detected.{womac_text}\n\nProvide a short, actionable insight in 2-3 sentences."}
            ]
            
            response: Any = llm.create_chat_completion(
                messages=messages,
                max_tokens=64,
                temperature=0.3,
            )
            
            content = response["choices"][0]["message"].get("content", "") if response else ""
            insight = content.strip() if content else "No insight generated."
            _current_insight = insight
            print(f"[LLM Output]: {insight}")
        else:
            _current_insight = dummy_llm_inference("")
            print(f"[Dummy LLM Output]: {_current_insight}")
    except Exception as e:
        print(f"Error generating insight: {e}")


_last_risk_class = None

def run_pipeline(sensor_data):
    global _llm_thread, _current_insight, _last_risk_class
    
    import os
    # Ensure BM25 index exists
    index_path = os.path.join(os.path.dirname(__file__), "bm25_index.pkl")
    if not os.path.exists(index_path):
        build_index()
        
    model = get_xgb_model()
    import pandas as pd
    import numpy as np
    
    # Extract non-sensor fields so they don't break XGBoost expectations
    womac_score = sensor_data.pop("womac_score", None)
    language = sensor_data.pop("language", "English")
    
    df = pd.DataFrame([sensor_data])
    probs = model.predict_proba(df)[0]
    risk_class = int(np.argmax(probs))
    risk_confidence = probs[risk_class]
    
    classes = ["Healthy", "Early OA Risk", "Severe OA"]
    result = {
        "risk_class": classes[risk_class],
        "risk_confidence": float(risk_confidence),
        "insight": "",
        "query": "",
        "shap_explanations": []
    }
    
    # SHAP integration for Explainable AI
    try:
        import shap
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(df)
        
        # XGBoost TreeExplainer returns a list for multiclass, or a 2D array for binary
        if isinstance(shap_values, list):
            sv = shap_values[risk_class][0]
        else:
            if len(shap_values.shape) > 1 and shap_values.shape[1] > 1:
                # Multiclass output in newer SHAP/XGBoost versions
                sv = shap_values[0, :, risk_class]
            else:
                sv = shap_values[0]
                
        feature_names = df.columns.tolist()
        feature_importance = [(feature_names[i], float(sv[i])) for i in range(len(feature_names))]
        # Sort by absolute impact
        feature_importance.sort(key=lambda x: abs(x[1]), reverse=True)
        
        result["shap_explanations"] = [
            {"feature": f[0], "impact": f[1]} for f in feature_importance[:3]
        ]
    except Exception as e:
        print(f"SHAP integration error: {e}")
    
    if risk_class > 0:
        result["query"] = "high plantar pressure asymmetric loading reduced emg amplitude"
        
        # Only spawn if the risk class changed OR if there's a new womac score/language
        if _last_risk_class != risk_class or womac_score is not None:
            _current_insight = f"Generating local LLM insight in {language}... (This may take a moment)"
            import threading
            _llm_thread = threading.Thread(target=_generate_insight_task, args=(classes[risk_class], womac_score, language), daemon=True)
            _llm_thread.start()
            _last_risk_class = risk_class
            
        result["insight"] = _current_insight
    else:
        result["insight"] = "Patient is healthy. No intervention needed."
        _last_risk_class = risk_class
        
    return result
