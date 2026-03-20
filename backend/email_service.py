import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from config import settings

def send_email(to_email: str, subject: str, body: str):
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_password = settings.SMTP_PASSWORD
    smtp_from = settings.SMTP_FROM

    if not all([smtp_user, smtp_password]) or "your_email" in smtp_user or "your_app_password" in smtp_password:
        print("MOCK SEND EMAIL (SMTP credentials missing or placeholders):", to_email)
        print("BODY:", body)
        return {"status": "mocked", "message": "SMTP credentials are missing or set to defaults in .env"}
        
    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_from
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'html'))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            
        return {"status": "sent"}
    except Exception as e:
        print("Failed to send email via SMTP:", str(e))
        return {"status": "error", "message": str(e)}
