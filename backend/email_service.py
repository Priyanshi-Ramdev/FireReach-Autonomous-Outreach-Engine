import resend
import os

def send_email(to_email: str, subject: str, body: str):
    resend.api_key = os.getenv("RESEND_API_KEY")
    if not resend.api_key:
        print("MOCK SEND EMAIL:", to_email)
        print("SUBJECT:", subject)
        print("BODY:", body)
        return {"status": "mocked"}
        
    try:
        params = {
            "from": "FireReach Agent <onboarding@resend.dev>",
            "to": to_email,
            "subject": subject,
            "html": f"<div style='white-space: pre-wrap;'>{body}</div>"
        }
        resend.Emails.send(params)
        return {"status": "sent"}
    except Exception as e:
        print("Failed to send email via Resend:", str(e))
        return {"status": "error", "message": str(e)}
