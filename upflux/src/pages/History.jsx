import { useEffect, useState, useContext } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";

function History() {
  const { user } = useContext(AuthContext);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, "quizAttempts"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "asc")
        );

        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            score: d.score || 0,
            total: d.total || 0,
            accuracy: d.accuracy || 0,
            xp: d.xp || 0,
            topics: d.topics || {},
            createdAt: d.createdAt?.toDate?.() || null,
          };
        });

        // Reverse to show newest first
        setAttempts(data.reverse());
      } catch (err) {
        console.error("Error fetching history:", err);
      }
      setLoading(false);
    };

    fetchHistory();
  }, [user]);

  if (loading) {
    return <p style={{ padding: "40px" }}>Loading history...</p>;
  }

  if (attempts.length === 0) {
    return <p style={{ padding: "40px" }}>No quiz attempts yet. Take a quiz to see your history.</p>;
  }

  return (
    <div style={{ padding: "40px" }}>
      <h2>Quiz History</h2>
      <p>Total Attempts: {attempts.length}</p>

      {attempts.map((attempt, index) => (
        <div key={attempt.id} style={{ borderBottom: "1px solid #ccc", padding: "15px 0" }}>
          <h4>Attempt #{attempts.length - index}</h4>
          <p>Score: {attempt.score} / {attempt.total}</p>
          <p>Accuracy: {attempt.accuracy.toFixed(1)}%</p>
          <p>XP Earned: {attempt.xp}</p>

          {Object.keys(attempt.topics).length > 0 && (
            <div>
              <strong>Topics:</strong>
              <ul>
                {Object.entries(attempt.topics).map(([topic, stats]) => (
                  <li key={topic}>
                    {topic}: {stats.correct}/{stats.total}
                    {" "}({((stats.correct / stats.total) * 100).toFixed(0)}%)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {attempt.createdAt && (
            <p>Date: {attempt.createdAt.toLocaleDateString()} {attempt.createdAt.toLocaleTimeString()}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default History;
