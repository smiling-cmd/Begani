import requests

# 1. Login
login_url = "http://127.0.0.1:8000/api/token/"
login_data = {
    "email": "student3@jkuat.ac.ke", # Use the one that worked!
    "password": "password123"        # Use the password that worked!
}
response = requests.post(login_url, json=login_data)
token = response.json().get("access")

# 2. Create a Mood Check-in (POST)
mood_url = "http://127.0.0.1:8000/api/wellbeing/moods/"
headers = {"Authorization": f"Bearer {token}"}
mood_data = {"score": 8, "source": "home"}
mood_response = requests.post(mood_url, headers=headers, json=mood_data)

print("Mood Status Code:", mood_response.status_code)
print("Mood Data:", mood_response.json())

# 3. Get the Mood Check-ins (GET)
get_moods_response = requests.get(mood_url, headers=headers)
print("\nFetching Moods Status Code:", get_moods_response.status_code)
print("All Moods:", get_moods_response.json())