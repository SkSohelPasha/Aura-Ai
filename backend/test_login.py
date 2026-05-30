import urllib.request
import json

url = "http://localhost:8000/api/v1/auth/login"
data = json.dumps({"email": "test@example.com", "password": "password123"}).encode("utf-8")
headers = {"Content-Type": "application/json"}

req = urllib.request.Request(url, data=data, headers=headers, method="POST")
try:
    with urllib.request.urlopen(req) as f:
        print(f.status)
        print(f.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode("utf-8"))
except Exception as e:
    print(e)
