import { useEffect, useState, useContext, useMemo, useRef } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

function Dashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState([]);
  const [availableTopics, setAvailableTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [totalXP, setTotalXP] = useState(0);
  const [level, setLevel] = useState(1);

  // Local analytics
  const [velocity, setVelocity] = useState(null);
  const [status, setStatus] = useState("");
  const [localInsights, setLocalInsights] = useState([]);

  // AI insights
  const [aiInsights, setAiInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const hasFetchedInsights = useRef(false);

  // ---------------- FETCH DATA ----------------
  useEffect(() => {
    const fetchAttempts = async () => {
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

        const data = snapshot.docs.map((doc, index) => ({
          attempt: index + 1,
          accuracy: doc.data().accuracy || 0,
          topics: doc.data().topics || {},
          xp: doc.data().xp || 0,
          ...doc.data()
        }));

        setAttempts(data);

        // XP calculation
        let xpSum = 0;
        data.forEach((a) => (xpSum += a.xp || 0));
        setTotalXP(xpSum);
        setLevel(Math.floor(xpSum / 200) + 1);

        setAvailableTopics([
          "Data Structures",
          "OOPS",
          "Python",
          "Machine Learning",
          "DBMS",
          "Operating Systems",
          "Custom"
        ]);

        setLoading(false);
      } catch (err) {
        console.error("Error fetching attempts:", err);
        setLoading(false);
      }
    };

    fetchAttempts();
  }, [user]);

  // ---------------- FILTER BY TOPIC ----------------
  const displayAttempts = useMemo(() => {
    if (selectedTopic === "All") return attempts;

    return attempts
      .map((attempt) => {
        const topicStats = attempt.topics?.[selectedTopic];
        if (!topicStats) return null;

        return {
          ...attempt,
          accuracy:
            (topicStats.correct / topicStats.total) * 100
        };
      })
      .filter(Boolean);
  }, [attempts, selectedTopic]);

  // ---------------- LOCAL ANALYTICS ENGINE ----------------
  useEffect(() => {
    if (displayAttempts.length === 0) {
      setVelocity(null);
      setStatus("");
      setLocalInsights([]);
      return;
    }

    const accuracies = displayAttempts.map((a) => a.accuracy);
    const insights = [];

    // Single attempt — show what we can
    if (accuracies.length === 1) {
      const acc = accuracies[0];
      setVelocity("N/A");

      if (acc >= 75) {
        insights.push({ type: "success", text: `Strong first attempt (${acc.toFixed(0)}%). Keep going!` });
        setStatus("Good Start");
      } else if (acc >= 50) {
        insights.push({ type: "info", text: `Decent start (${acc.toFixed(0)}%). Room for improvement.` });
        setStatus("Needs Practice");
      } else {
        insights.push({ type: "warning", text: `Low accuracy (${acc.toFixed(0)}%). Focus on fundamentals.` });
        setStatus("Needs Attention");
      }

      insights.push({ type: "info", text: "Take more quizzes to unlock trend analysis and stagnation detection." });
      setLocalInsights(insights);
      return;
    }

    // Multiple attempts — full analytics
    const first = accuracies[0];
    const last = accuracies[accuracies.length - 1];
    const slope = (last - first) / (displayAttempts.length - 1);

    setVelocity(slope.toFixed(2));

    // Trend detection
    if (slope < -2) {
      insights.push({ type: "danger", text: "Performance is declining sharply. Immediate revision needed." });
    } else if (slope < 0) {
      insights.push({ type: "warning", text: "Slight downward trend detected. Review weak areas." });
    } else if (slope < 1) {
      insights.push({ type: "info", text: "Growth rate is slow. Increase focused practice." });
    } else {
      insights.push({ type: "success", text: "Learning curve is improving steadily." });
    }

    // Stagnation detection (last 3 attempts within 3% range)
    if (accuracies.length >= 3) {
      const recent3 = accuracies.slice(-3);
      const range = Math.max(...recent3) - Math.min(...recent3);
      if (range <= 3) {
        insights.push({ type: "warning", text: "Stagnation detected: last 3 attempts show no meaningful improvement. Change your study approach." });
      }
    }

    // Consistency check
    const variance = Math.max(...accuracies) - Math.min(...accuracies);
    if (variance > 40) {
      insights.push({ type: "warning", text: "Performance is highly inconsistent across attempts." });
    } else if (variance < 10 && accuracies.length >= 3) {
      insights.push({ type: "success", text: "Performance is consistent. Good stability." });
    }

    // Recent momentum (last 2 vs previous 2)
    if (accuracies.length >= 4) {
      const prev2Avg = (accuracies[accuracies.length - 4] + accuracies[accuracies.length - 3]) / 2;
      const last2Avg = (accuracies[accuracies.length - 2] + accuracies[accuracies.length - 1]) / 2;
      if (last2Avg - prev2Avg > 10) {
        insights.push({ type: "success", text: "Strong recent momentum. Keep it up!" });
      } else if (prev2Avg - last2Avg > 10) {
        insights.push({ type: "danger", text: "Recent drop in performance. Revisit fundamentals." });
      }
    }

    // Average accuracy insight
    const avg = accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;
    if (avg >= 75) {
      insights.push({ type: "success", text: `Average accuracy: ${avg.toFixed(0)}%. Strong overall.` });
    } else if (avg >= 50) {
      insights.push({ type: "info", text: `Average accuracy: ${avg.toFixed(0)}%. Improving but needs work.` });
    } else {
      insights.push({ type: "warning", text: `Average accuracy: ${avg.toFixed(0)}%. Below threshold — prioritize weak topics.` });
    }

    // XP-based insights
    if (totalXP < 200) {
      insights.push({ type: "info", text: "Early learning stage. Complete more quizzes to level up." });
    } else if (level >= 5) {
      insights.push({ type: "success", text: "Advanced learner. Challenge yourself with hard difficulty." });
    } else if (level >= 3) {
      insights.push({ type: "info", text: "Good engagement. Try higher difficulty quizzes." });
    }

    // Stagnation index for status
    const growthDrop = first - last;
    const stagnationIndex = 0.5 * Math.max(0, growthDrop) + 0.3 * (3 - Math.min(3, Math.abs(slope)));

    if (stagnationIndex > 3) {
      setStatus("High Stagnation Risk");
    } else if (stagnationIndex > 1.5) {
      setStatus("Moderate Risk");
    } else {
      setStatus("Stable Learning Growth");
    }

    setLocalInsights(insights);
  }, [displayAttempts, totalXP, level]);

  // ---------------- AI INSIGHTS ENGINE ----------------
  useEffect(() => {
    if (attempts.length < 1 || hasFetchedInsights.current) return;
    hasFetchedInsights.current = true;

    const fetchInsights = async () => {
      setInsightsLoading(true);

      // Aggregate topic stats across all attempts
      const aggregatedTopics = {};
      attempts.forEach((a) => {
        if (!a.topics) return;
        Object.entries(a.topics).forEach(([topic, stats]) => {
          if (!aggregatedTopics[topic]) {
            aggregatedTopics[topic] = { correct: 0, total: 0 };
          }
          aggregatedTopics[topic].correct += stats.correct || 0;
          aggregatedTopics[topic].total += stats.total || 0;
        });
      });

      // Latest quiz as current, rest as previous
      const latest = attempts[attempts.length - 1];
      const previous = attempts.slice(0, -1).slice(-5).map((a) => ({
        overallScore: a.accuracy || 0
      }));

      try {
        const res = await fetch("http://localhost:5000/analyze-performance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentQuiz: {
              overallScore: latest.accuracy || 0,
              difficulty: "medium",
              topics: aggregatedTopics
            },
            previousQuizzes: previous
          })
        });
        
        if (!res.ok) {
          throw new Error(`Backend server not available (${res.status})`);
        }
        
        const data = await res.json();
        setAiInsights(data);
      } catch (err) {
        // Silently handle backend unavailability - don't log errors for missing backend
        console.log("AI insights unavailable - backend server not running");
        setAiInsights({ error: "Backend unavailable" });
      }
      setInsightsLoading(false);
    };

    fetchInsights();
  }, [attempts]);

  if (loading) {
    return <h2 style={{ padding: "40px" }}>Loading...</h2>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div style={{ padding: "40px" }}>
        <button
          onClick={() => navigate("/quiz")}
          style={{
            marginTop: "15px",
            padding: "8px 16px",
            backgroundColor: "#6366f1",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Start Quiz
        </button>

      {/* XP */}
      <div
        style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: "#ecfdf5",
          borderRadius: "8px",
          border: "1px solid #10b981"
        }}
      >
        <h3>Level: {level}</h3>
        <p>Total XP: {totalXP}</p>
      </div>

      {/* Topic Filter */}
      <div style={{ marginTop: "20px" }}>
        <h3>Filter by Topic</h3>
        <select
          value={selectedTopic}
          onChange={(e) =>
            setSelectedTopic(e.target.value)
          }
        >
          <option value="All">All Topics</option>
          {availableTopics.map((topic, index) => (
            <option key={index} value={topic}>
              {topic}
            </option>
          ))}
        </select>
      </div>

      <p style={{ marginTop: "20px" }}>
        Total Attempts: {displayAttempts.length}
      </p>

      {displayAttempts.length === 0 && selectedTopic !== "All" && (
        <p style={{ marginTop: "10px" }}>No attempts found for {selectedTopic}. Take a quiz on this topic to see analytics.</p>
      )}

      {/* Local Analytics */}
      {velocity !== null && (
        <div style={{ marginTop: "20px" }}>
          <h3>Learning Velocity: {velocity}</h3>
          <h3>Status: {status}</h3>

          {localInsights.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <h4>Insights</h4>
              <ul>
                {localInsights.map((ins, i) => (
                  <li key={i}>{ins.text}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* AI Insights */}
      {insightsLoading && <p>Loading AI insights...</p>}

      {aiInsights && aiInsights.error && (
        <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#fef3c7", borderRadius: "8px", border: "1px solid #f59e0b" }}>
          <h3>AI Performance Analysis</h3>
          <p style={{ color: "#92400e" }}>
            AI insights are currently unavailable. The backend server is not running. 
            You can still use all other features including local analytics and performance tracking.
          </p>
        </div>
      )}

      {aiInsights && !aiInsights.error && (
        <div style={{ marginTop: "20px" }}>
          <h3>AI Performance Analysis</h3>

          <div>
            <h4>Summary</h4>
            <p>{aiInsights.performanceSummary}</p>
          </div>

          <div>
            <h4>Learning Velocity</h4>
            <p>{aiInsights.learningVelocity}</p>
          </div>

          <div>
            <h4>Trend</h4>
            <p>{aiInsights.trendAnalysis}</p>
          </div>

          <div>
            <h4>Risk Level</h4>
            <p>{aiInsights.riskLevel}</p>
          </div>

          {aiInsights.weakTopics?.length > 0 && (
            <div>
              <h4>Weak Topics</h4>
              <ul>
                {aiInsights.weakTopics.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          {aiInsights.moderateTopics?.length > 0 && (
            <div>
              <h4>Moderate Topics</h4>
              <ul>
                {aiInsights.moderateTopics.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          {aiInsights.strongTopics?.length > 0 && (
            <div>
              <h4>Strong Topics</h4>
              <ul>
                {aiInsights.strongTopics.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          <div>
            <h4>Recommended Difficulty</h4>
            <p>{aiInsights.recommendedDifficulty}</p>
          </div>

          {aiInsights.studyPlan && (
            <div>
              <h4>3-Day Study Plan</h4>
              <p><strong>Day 1:</strong> {aiInsights.studyPlan.day1}</p>
              <p><strong>Day 2:</strong> {aiInsights.studyPlan.day2}</p>
              <p><strong>Day 3:</strong> {aiInsights.studyPlan.day3}</p>
            </div>
          )}

          {aiInsights.improvementStrategies?.length > 0 && (
            <div>
              <h4>Improvement Strategies</h4>
              <ol>
                {aiInsights.improvementStrategies.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          )}

          {aiInsights.motivation && (
            <div>
              <h4>Motivation</h4>
              <p>{aiInsights.motivation}</p>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {displayAttempts.length > 0 && (
        <div
          style={{
            width: "100%",
            height: 300,
            marginTop: "30px"
          }}
        >
          <ResponsiveContainer>
            <LineChart data={displayAttempts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="attempt" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#6366f1"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      </div>
    </div>
  );
}

export default Dashboard;