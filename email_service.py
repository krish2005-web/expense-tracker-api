import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()


def send_otp_email(email, otp):

    sender_email = os.getenv("SMTP_EMAIL")
    password = os.getenv("SMTP_PASSWORD")

    message = EmailMessage()

    message["Subject"] = "Moneta - Password Reset OTP"
    message["From"] = sender_email
    message["To"] = email

    message.set_content(f"""
    

    Your Moneta password reset OTP is: {otp}

    This OTP will expire in 5 minutes.

    Do not share this OTP with anyone.

    -Moneta Team
    """)

    server = smtplib.SMTP("smtp.gmail.com", 587)
    server.starttls()

    server.login(sender_email, password)
    server.send_message(message)

    server.quit()