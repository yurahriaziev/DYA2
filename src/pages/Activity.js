/**
 * Activity Component
 * 
 * The `Activity` component is responsible for displaying and managing a coding activity.
 * Users can write and test code, track their progress, and earn XP upon successful completion of tasks.
 * The component integrates with Firebase for data persistence and communicates with a backend server to run code tests.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import '../css/Activity.css';
import CodeEditor from '../components/CodeEditor';
import axios from 'axios';
import TestResultsPopup from '../components/TestResultsPopup';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5002');

function Activity() {
  const { uid, activityTitle, activityOrder } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [serverStatus, setServerStatus] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [userCode, setUserCode] = useState('');
  const [shake, setShake] = useState(false);
  const [fireworks, setFireworks] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('Python'); // Default to Python
  const [slideDown, setSlideDown] = useState(false);

  const date = new Date();

  /**
   * addUserXP
   * 
   * @description Adds XP to the user's account and updates their daily login activity.
   * @param {number} xp - The amount of XP to add.
   */
  const addUserXP = async (xp) => {
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);

    const today = date.toISOString().split('T')[0];

    const userActivityDocRef = doc(db, 'userActivity', uid);
    const docSnap = await getDoc(userActivityDocRef);
    const userLoginData = docSnap.data().loginData;

    let currentDay = userLoginData.find((date) => date.day === today);
    if (!currentDay) {
      // If the current day is not found, add a new entry
      currentDay = { day: today, xp: 0 };
      userLoginData.push(currentDay);
    }

    currentDay.xp += xp;

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      const currentXP = userData.xp || 0;
      await setDoc(
        userDocRef,
        {
          xp: currentXP + xp,
        },
        { merge: true }
      );
      await updateDoc(userActivityDocRef, {
        loginData: userLoginData,
      });
    }
  };

  useEffect(() => {
    /**
     * fetchActivityAndUserProgress
     * 
     * @description Fetches the current activity data and user progress from the database.
     */
    const fetchActivityAndUserProgress = async () => {
      try {
        if (!uid || !activityTitle || !activityOrder) {
          setError('Missing URL parameters');
          return;
        }

        const userDocRef = doc(db, 'users', uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          setError('User not found');
          return;
        }

        const userData = userDocSnap.data();
        setCurrentLanguage(userData.currentLanguage || 'Python'); // Set the current language from user data

        const activitiesCollection = collection(db, `activities${userData.currentLanguage}`);
        const activitiesSnapshot = await getDocs(activitiesCollection);
        const activitiesData = activitiesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const activity = activitiesData.find(
          (act) => act.title.replace(/\s+/g, '-') === activityTitle && act.order.toString() === activityOrder
        );
        if (!activity) {
          setError('Activity not found');
          return;
        }

        setActivity(activity);
        setShuffledQuestions(shuffleArray(activity.questions));
        setCurrentQuestionIndex(0);

        // Load the user's progress
        const progressDocRef = doc(db, 'users', uid, 'activities', userData.currentLanguage, 'activityOrder', activityOrder);
        const progressDocSnap = await getDoc(progressDocRef);
        if (progressDocSnap.exists()) {
          const progressData = progressDocSnap.data();
          setCorrectCount(progressData.correctCount || 0);
          setIncorrectCount(progressData.incorrectCount || 0);

          // If the activity was completed, reset progress
          if (progressData.completed) {
            resetProgress();
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityAndUserProgress();
  }, [uid, activityTitle, activityOrder]);

  useEffect(() => {
    /**
     * Socket Listener
     * 
     * @description Listens for test results from the backend and updates the state accordingly.
     */
    socket.on('test_results', (data) => {
      console.log('Received test results:', data);
      setTestResults(data.testResults || []);
      setResult(data.success ? 'Success! You got it right.' : `Incorrect output:\n${data.message}`);

      if (data.success && isSubmitting) {
        setFireworks(true);
        setTimeout(() => setFireworks(false), 1000);
        setCorrectCount((prevCount) => prevCount + 1);
        updateUserProgress({ correctCount: correctCount + 1 });

        if (correctCount + 1 === 5) {
          updateUserProgress({ completed: true });
          setShowAnimation(true);
          setCompleted(true);
          unlockNextActivity(); // Unlock the next activity
          addUserXP(100); // Grant 100 XP for completing the activity
          setTimeout(() => {
            setShowAnimation(false);
            setCurrentQuestionIndex(shuffledQuestions.length);
          }, 3000); // duration of the animation
        } else {
          setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
          setResult(null);
        }
      } else if (!data.success && isSubmitting) {
        setShake(true);
        setTimeout(() => setShake(false), 1000);
        setIncorrectCount((prevCount) => prevCount + 1);
        updateUserProgress({ incorrectCount: incorrectCount + 1 });
        if (incorrectCount + 1 === 3) {
          alert('You have 3 incorrect answers. Restarting...');
          setCorrectCount(0);
          setIncorrectCount(0);
          setCurrentQuestionIndex(0);
          setShuffledQuestions(shuffleArray(activity.questions));
          setResult(null);
        }
      }

      setIsSubmitting(false);
    });

    return () => {
      socket.off('test_results');
    };
  }, [correctCount, incorrectCount, shuffledQuestions, isSubmitting]);

  /**
   * updateUserProgress
   * 
   * @description Updates the user's progress for the current activity in the database.
   * @param {Object} progressUpdates - The progress updates to save.
   */
  const updateUserProgress = async (progressUpdates) => {
    const progressDocRef = doc(db, 'users', uid, 'activities', currentLanguage, 'activityOrder', activityOrder);
    const progressDocSnap = await getDoc(progressDocRef);

    const progressData = progressDocSnap.exists() ? progressDocSnap.data() : {};
    await setDoc(progressDocRef, {
      ...progressData,
      ...progressUpdates,
    });
  };

  /**
   * resetProgress
   * 
   * @description Resets the user's progress for the current activity.
   */
  const resetProgress = async () => {
    const progressDocRef = doc(db, 'users', uid, 'activities', currentLanguage, 'activityOrder', activityOrder);
    await setDoc(progressDocRef, {
      correctCount: 0,
      incorrectCount: 0,
      completed: false,
    }, { merge: true });

    setCorrectCount(0);
    setIncorrectCount(0);
    setCompleted(false);
  };

  /**
   * unlockNextActivity
   * 
   * @description Unlocks the next activity for the user and updates their progress.
   */
  const unlockNextActivity = async () => {
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      const newActivityOrder = parseInt(activityOrder) + 1;

      const currentLanguage = userData.currentLanguage;
      const updatedProgrammingLanguages = userData.programmingLanguages.map((lang) =>
        lang.langName === currentLanguage ? { ...lang, currentActivity: newActivityOrder } : lang
      );

      await setDoc(
        userDocRef,
        {
          ...userData,
          currentActivity: newActivityOrder,
          programmingLanguages: updatedProgrammingLanguages,
        },
        { merge: true }
      );

      console.log(`Next activity unlocked: ${newActivityOrder}`);
    }
  };

  /**
   * handleCodeChange
   * 
   * @description Updates the userCode state when the code in the editor changes.
   * @param {string} newCode - The new code entered by the user.
   */
  const handleCodeChange = (newCode) => {
    setUserCode(newCode);
  };

  /**
   * handleRunTests
   * 
   * @description Sends the user's code to the backend to run tests.
   * @param {string} userCode - The code entered by the user.
   * @param {number} testCount - The number of tests to run.
   */
  const handleRunTests = async (userCode, testCount) => {
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    const funcName = currentQuestion.functionName;

    try {
      if (!currentQuestion.id || !uid || !activityOrder) {
        setError('Missing parameters for Firestore document reference');
        return;
      }

      // Create the JSON payload
      const payload = {
        functionName: funcName,
        activityOrder: activityOrder,
        userId: uid,
        questionId: currentQuestion.id,
        userCode: userCode,
        language: currentLanguage,
        testCount,
      };

      // Send the payload to the backend
      await axios.post('http://localhost:5002/test-function', payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error(`Error testing ${funcName}:`, error);
    }
  };

  /**
   * handleCodeSubmit
   * 
   * @description Submits the user's code to Firestore and sends it to the backend for testing.
   * @param {string} userCode - The code entered by the user.
   * @param {number} testCount - The number of tests to run.
   */
  const handleCodeSubmit = async (userCode, testCount) => {
    setIsSubmitting(true);
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    const funcName = currentQuestion.functionName;

    try {
      if (!currentQuestion.id || !uid || !activityOrder) {
        setError('Missing parameters for Firestore document reference');
        return;
      }

      // Save the user's code to Firestore
      await setDoc(
        doc(db, 'users', uid, 'activities', currentLanguage, 'activityOrder', activityOrder, 'questions', currentQuestion.id),
        {
          functionName: funcName,
          userCode: userCode,
        }
      );

      // Create the JSON payload
      const payload = {
        functionName: funcName,
        activityOrder: activityOrder,
        userId: uid,
        questionId: currentQuestion.id,
        userCode: userCode,
        language: currentLanguage,
        testCount,
      };

      // Send the payload to the backend
      await axios.post('http://localhost:5002/test-function', payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error(`Error testing ${funcName}:`, error);
      setIsSubmitting(false);
    }
  };

  /**
   * shuffleArray
   * 
   * @description Randomly shuffles an array of questions.
   * @param {Array} array - The array to shuffle.
   * @returns {Array} - The shuffled array.
   */
  const shuffleArray = (array) => {
    const shuffledArray = array.slice();
    for (let i = shuffledArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
    }
    return shuffledArray;
  };

  /**
   * handleBackClick
   * 
   * @description Navigates the user back to the previous page.
   */
  const handleBackClick = () => {
    navigate(-1);
  };

  /**
   * handleNextActivity
   * 
   * @description Navigates the user to the next activity.
   */
  const handleNextActivity = () => {
    navigate(`/activities/${uid}/${activityTitle}/${parseInt(activityOrder) + 1}`);
  };

  /**
   * handleMainMenu
   * 
   * @description Navigates the user to the main menu (roadmap).
   */
  const handleMainMenu = () => {
    navigate(`/roadmap/${uid}`);
  };

  /**
   * checkServerStatus
   * 
   * @description Checks the status of the backend server.
   */
  const checkServerStatus = async () => {
    try {
      const response = await axios.get('http://localhost:5002/ping');
      setServerStatus(response.data.message);
    } catch (error) {
      setServerStatus('Error: Unable to reach the server.');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  if (activity && (currentQuestionIndex >= shuffledQuestions.length || completed)) {
    return (
      <div className="activity-page">
        <h2 className="activity-title">{activity.title}</h2>
        <p className="activity-description">Congratulations! You've completed all the questions.</p>
        {showAnimation && <div className="animation">Next Activity Unlocked!</div>}
        <div className="completion-buttons">
          <button className='activity-button' onClick={handleNextActivity}>Next Activity</button>
          <button className='activity-button' onClick={handleMainMenu}>Main Menu</button>
        </div>
      </div>
    );
  }

  const currentQuestion = shuffledQuestions[currentQuestionIndex];

  return (
    <div className={`activity-page ${shake ? 'shake' : ''}`}>
      {fireworks && (
        <div className="fireworks">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      )}
      {activity && (
        <>
          <div className='activity-header'>
            <button onClick={handleBackClick} className='back-btn'>
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <h2 className="activity-title">{activity.title}</h2>
          </div>
          <p className="activity-description">{activity.description}</p>
          <div className="status-section">
            <div className="status">
               <div className="status-content correct">{correctCount}</div>
               <div className="status-content incorrect">{incorrectCount}</div>
             </div>
            </div>
          <div className={`activities-container ${slideDown ? 'slide-down' : ''}`}>
            <CodeEditor
              currentQuestion={currentQuestion}
              onCodeSubmit={handleCodeSubmit}
              onRunTests={handleRunTests}
              onCodeChange={handleCodeChange}
              userId={uid}
              language={currentLanguage}
              activityOrder={activityOrder}
              setOutput={() => {}}
            />
          </div>
          {result && <div className="result-section"><pre>{result}</pre></div>}
          {isSubmitting && <div className="loading">Submitting...</div>}
          <div id="mycanvas"></div>
          <button className='code-editor-button' onClick={checkServerStatus}>Check Server Status</button>
          {serverStatus && <div className="server-status">{serverStatus}</div>}
          {testResults.length > 0 && (
            <TestResultsPopup results={testResults} onClose={() => setTestResults([])} />
          )}
        </>
      )}
    </div>
  );
}

export default Activity;
