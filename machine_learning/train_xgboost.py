import pandas as pd
import numpy as np

import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import json
import os

from machine_learning.data_preprocessing import get_merged_training_data

def main():
    print("Loading mapped PhysioNet data + synthetic baseline...")
    
    # We change the CWD to the current script directory so that the data/ paths resolve
    original_cwd = os.getcwd()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    try:
        df = get_merged_training_data(1000)
    finally:
        os.chdir(original_cwd)
    
    X = df.drop('target', axis=1)
    y = df['target']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training lightweight XGBoost classifier...")
    # Max depth and estimators kept very low for Raspberry Pi 3 inference
    model = xgb.XGBClassifier(
        max_depth=4,
        n_estimators=100,
        learning_rate=0.1,
        objective='multi:softprob',
        num_class=3
    )
    
    model.fit(X_train, y_train)
    
    preds = model.predict(X_test)
    print("\n=== Real Dataset Training Results ===")
    print("Model Accuracy:", accuracy_score(y_test, preds))
    print(classification_report(y_test, preds))
    
    # Save the model relative to this file
    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "oa_risk_model.json")
    model.save_model(model_path)
    print(f"Model saved successfully to {model_path} for Edge Deployment.")

if __name__ == "__main__":
    main()
