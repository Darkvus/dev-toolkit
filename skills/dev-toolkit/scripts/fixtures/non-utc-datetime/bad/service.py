from datetime import datetime, date

created = datetime.utcnow()
now = datetime.now()
today = date.today()
madrid = datetime.now(ZoneInfo("Europe/Madrid"))
stamp = datetime.fromtimestamp(1700000000)
TIME_ZONE = "Europe/Madrid"
