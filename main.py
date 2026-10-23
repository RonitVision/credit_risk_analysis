from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import joblib
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

ml_model={}

@asynccontextmanager
async def lifespan(app: FastAPI):
    ml_model['model'] = joblib.load("credit_risk_model.pkl")  # Load the trained model
    ml_model['threshold'] = joblib.load('best_threshold.pkl')

    yield

    ml_model.clear()  # Clean up the model when the application shuts down

app = FastAPI(lifespan=lifespan)

#app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

'''@app.get("/")
def greet():
    return {"message": "Hello!, RONIT!"}'''

#columns that the user will see and interact with
#pydantic model(validation) for the input data
class LoanApplication(BaseModel):
    person_age: int
    person_income: float
    person_home_ownership: str
    person_emp_length: float
    loan_intent: str
    loan_grade: str
    loan_amnt: float
    loan_int_rate: float
    loan_percent_income: float
    cb_person_default_on_file: str
    cb_person_cred_hist_length: float

@app.post("/predict")
def predict(data: LoanApplication):
    input_df = pd.DataFrame([data.dict()])  # Convert the input data to a DataFrame

    probability = ml_model['model'].predict_proba(input_df)[:, 1][0] # Get the probability of default
    prediction = int(probability >= ml_model['threshold'])  # Apply the threshold
    return {
        "default_probability": probability,
        "default_prediction": prediction,
        "threshold": ml_model['threshold'],
        "result": "High risk of default" if prediction == 1 else "Low risk of default",
    }


app.mount("/", StaticFiles(directory="static", html=True), name="static")
