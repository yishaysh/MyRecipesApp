# Background Task Time Counter Rule

Whenever executing or launching a long-running command or task in the background:
1. **Start Announcement**: Immediately post an update in the chat indicating what operation is running, start timestamp, and estimated duration (e.g., `⏳ התחלתי פעולה: בניית פרויקט | זמן משוער: 30-45 שניות`).
2. **Progress & Timer Tracking**: Keep track of elapsed seconds and schedule periodic status/heartbeat updates so the user always knows the agent is alive and working.
3. **Completion Report**: Upon completion, explicitly report the total elapsed time in seconds/minutes (e.g., `✅ הפעולה הסתיימה בהצלחה לאחר 42 שניות`).
