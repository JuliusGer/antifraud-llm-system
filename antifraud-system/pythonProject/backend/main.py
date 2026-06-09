from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import psycopg2

app = FastAPI()

# разрешаем frontend обращаться к backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# подключение к PostgreSQL
conn = psycopg2.connect(
    host="localhost",
    database="FraudDetection",
    user="postgres",
    password="admin",
    port="5432"
)

# dashboard
@app.get("/dashboard")
def dashboard():
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT COUNT(*) as total,
            count(case when fraud_pred = 1 then 1 end) as predicted_frauds,
            sum(amt) as total_amount,
            ROUND(sum(case when fraud_pred = 1 then amt end)::decimal,0) as predicted_frauds_amount,
            ROUND((sum(case when fraud_pred = 1 then amt end)/nullif(sum(amt),0)*100)::decimal,2) as predicted_frauds_amount_share
            FROM public."public.fraud_predictions_datamart"
            where trans_date_trans_time::date between '2020-11-01'::date and '2020-11-05'::date;
        """)

        row = cur.fetchone()  # ← fetchone, не fetchall — одна строка агрегатов

        return {
            "total_operations": row[0],
            "suspicious_operations": row[1],
            "total_amount": row[2],
            "fraud_sum": row[3],
            "fraud_sum_share": row[4]
        }

    except Exception as e:
        conn.rollback()
        return {"error": str(e)}

# список операций
@app.get("/operations")

def operations():

    cur = conn.cursor()

    cur.execute("""
        SELECT trans_num, trans_date_trans_time,amt, category,fraud_pred_proba
        FROM "public.fraud_predictions_datamart"
        WHERE fraud_pred = 1
        and trans_date_trans_time::date between '2020-11-01'::date and '2020-11-05'::date
        ORDER BY trans_date_trans_time DESC
    """)

    rows = cur.fetchall()

    result = []

    for row in rows:

        result.append({
            "transaction_id": row[0],
            "transaction_ts": row[1],
            "amount": row[2],
            "category": row[3],
            "fraud_probability": row[4]
        })

    return result

# подробная операция
@app.get("/operation/{trans_num}")

def operation(trans_num: str):

    try:

        cur = conn.cursor()

        # информация по операции
        cur.execute("""
            SELECT 
            fl.trans_num,
            fl.feature_name,
            fl.feature_value,
            t1."shap"/sum(t1."shap") over (partition by t1.trans_num) *100 as contribution_pct,
            t1.fraud_pred_proba
            FROM public.fraud_features_long fl
            INNER JOIN public."public.predicted_frauds_shap" t1
                ON fl.trans_num = t1.trans_num
                AND fl.feature_name = t1."feature"
            WHERE 1=1
            and t1."shap" > 0
            and t1.trans_num = %s
            order by contribution_pct desc
        """, (trans_num,))

        features = cur.fetchall()

        shap_features = []

        for row in features:
            shap_features.append({
                "trans_num": row[0],
                "feature_name": row[1],
                "feature_value": row[2],
                "contribution_pct": row[3],
                "fraud_pred_proba": row[4]
            })

        return shap_features

    except Exception as e:

        conn.rollback()

        return {
            "error": str(e)
        }
# аналитическая справка для оператора
@app.get("/report/{trans_num}")
def report(trans_num: str):
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
            replace(replace(operator_report,'RUB', '$'),'рубля','$') as operator_report,
            replace(replace(client_message,'RUB', '$'),'рубля','$') as client_message,
            generated_at
            FROM public.fraud_operator_reports
            WHERE tr_num = %s
        """, (trans_num,))
        row = cur.fetchone()
        if not row:
            return {"operator_report": None, "client_message": None, "generated_at": None}
        return {
            "operator_report": row[0],
            "client_message":  row[1],
            "generated_at":    row[2].isoformat() if row[2] else None,
        }
    except Exception as e:
        conn.rollback()
        return {"error": str(e)}
