import urllib.request
import json
import random

url_signup = "http://localhost:8000/api/v1/auth/signup"
url_login = "http://localhost:8000/api/v1/auth/login"

email = f"test{random.randint(1,10000)}@example.com"
data = json.dumps({"email": email, "username": f"testuser{random.randint(1,100000)}", "password": "password123"}).encode("utf-8")
headers = {"Content-Type": "application/json"}

# Signup
req = urllib.request.Request(url_signup, data=data, headers=headers, method="POST")
try:
    with urllib.request.urlopen(req) as f:
        print(f"Signup: {f.status}")
except urllib.error.HTTPError as e:
    print(f"Signup error: {e.code} - {e.read().decode('utf-8')}")

# Login
data_login = json.dumps({"email": email, "password": "password123"}).encode("utf-8")
req2 = urllib.request.Request(url_login, data=data_login, headers=headers, method="POST")
try:
    with urllib.request.urlopen(req2) as f:
        print(f"Login: {f.status}")
except urllib.error.HTTPError as e:
    print(f"Login error: {e.code} - {e.read().decode('utf-8')}")
