# BEGANI — Share the load.

A student wellbeing and counselling web app: an AI companion (TUA), booking and chat with counsellors and
therapists, mood check-ins and journalling, wellbeing activities, resources, and an admin portal.

- **Frontend:** React 19 + Vite + React Router (`frontend/`)
- **Backend:** Django REST Framework + JWT (`backend/`)
- **Roles:** student, therapist (school counsellor or private), admin

## Run it locally

Backend (Python 3.12+):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # then fill in the values
python manage.py migrate
python manage.py seed_audio                            # optional: sample wellbeing audio
python manage.py runserver                             # http://127.0.0.1:8000
```

Frontend (Node 20+):

```bash
cd frontend
npm install
npm run dev                                            # http://localhost:5173
```

## Checks

```bash
cd backend && python manage.py test                    # backend tests
cd frontend && npm run lint && npm run build           # lint and production build
```

## Notes

- Private chats, journals, TUA conversations and counsellor reports are encrypted at rest; set `ENCRYPTION_KEY`
  in production (see `backend/.env.example`).
- Payments use Paystack (M-Pesa); set `PAYSTACK_SECRET_KEY` and the webhook URL in production.
- Run `python manage.py purge_tua_conversations` on a daily schedule to clear expired TUA chats.
