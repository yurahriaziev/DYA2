/**
 * App Component
 * 
 * The `App` component serves as the main entry point for the application. It manages the routing for different pages
 * such as the home page, login, signup, and various educational sections. It also controls the display of popups
 * for login and signup, and handles navigation between different routes.
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import '../css/App.css';
import Roadmap from './Roadmap';
import Activity from './Activity';
import ChildSignup from './ChildSignup';
import NewLogin from './NewLogin';
import SignUpTypePopUp from '../components/SignUpTypePopUp';
import Footer from '../components/Footer';
import LanguageSlider from '../components/LanguageSlider';
import MascotSection from '../components/MascotSection';
import Lessons from "./Lessons";
import ParentHub from "./ParentHub";
import Practice from "./Practice"; 
import Ranking from "./Ranking"; 
import Lesson from './Lesson';

function App() {
  const navigate = useNavigate();

  /**
   * handleRouteChange
   * 
   * @description Navigates to the specified route.
   * @param {string} route - The route to navigate to.
   */
  const handleRouteChange = (route) => {
    if (route) {
      navigate(route);
    } else {
      console.error("Undefined route passed to handleRouteChange");
    }
  };

  const [showSignUpPopUp, setShowSignUpPopUp] = useState(false);
  const [showSignUpForm, setShowSignUpForm] = useState(false);
  const [showLoginPopUp, setShowLoginPopUp] = useState(false);

  useEffect(() => {
    /**
     * useEffect
     * 
     * @description Resets the state of popups when the route changes.
     */
    setShowSignUpPopUp(false);
    setShowSignUpForm(false);
    setShowLoginPopUp(false);
  }, [navigate]);

  /**
   * toggleSignUpPopUp
   * 
   * @description Toggles the visibility of the sign-up popup.
   */
  const toggleSignUpPopUp = () => {
    setShowSignUpPopUp(!showSignUpPopUp);
    setShowSignUpForm(false);
    setShowLoginPopUp(false);
  };

  /**
   * toggleSignUpForm
   * 
   * @description Shows the sign-up form within the popup.
   */
  const toggleSignUpForm = () => {
    setShowSignUpForm(true);
  };

  /**
   * toggleLoginPopUp
   * 
   * @description Toggles the visibility of the login popup.
   */
  const toggleLoginPopUp = () => {
    setShowSignUpPopUp(false);
    setShowLoginPopUp(!showLoginPopUp);
  };

  return (
    <div className="App">
      <Routes>
        <Route path="/" element={
          <div>
            <header className="App-header">
              <div className="auth-buttons">
                <button className="auth-button" onClick={toggleLoginPopUp}>Log In</button>
                <button className="auth-button" onClick={toggleSignUpPopUp}>Sign Up</button>
              </div>
              <h1>Welcome to DYA!</h1>
              <p>Your ultimate fun and learning destination for kids.</p>
            </header>
            <main>
              {showSignUpPopUp && (
                <div className='popup-overlay' onClick={() => setShowSignUpPopUp(false)}>
                  <div className='popup-content' onClick={(e) => e.stopPropagation()}>
                    {showSignUpForm ? (
                      <ChildSignup
                        setShowSignUpForm={setShowSignUpForm}
                        toggleLoginPopUp={toggleLoginPopUp}
                      />
                    ) : (
                      <SignUpTypePopUp
                        showSignUpForm={toggleSignUpForm}
                        handleRouteChange={handleRouteChange}
                        toggleLoginPopUp={toggleLoginPopUp}
                      />
                    )}
                  </div>
                </div>
              )}
                
              {showLoginPopUp && (
                <div className='popup-overlay' onClick={() => setShowLoginPopUp(false)}>
                  <div className='popup-content' onClick={(e) => e.stopPropagation()}>
                    <NewLogin
                      handleRouteChange={handleRouteChange}
                      toggleSignUpPopUp={toggleSignUpPopUp}
                      toggleLoginPopUp={toggleLoginPopUp}
                    />
                  </div>
                </div>
              )}
              <div className={`main-content ${showSignUpPopUp || showLoginPopUp ? 'blur' : ''}`}>
                <section className="features">
                  <div className="feature feature-games">
                    <h3>Games</h3>
                    <p>Engage in exciting and educational games designed for kids.</p>
                  </div>
                  <div className="feature feature-videos">
                    <h3>Interactive</h3>
                    <p>Everything is fun and interactive making it easier to learn!</p>
                  </div>
                  <div className="feature feature-activities">
                    <h3>Activities</h3>
                    <p>Participate in creative and fun activities to learn new things.</p>
                  </div>
                </section>

                <LanguageSlider />

              </div>
            </main>
            <Footer />
          </div>
        } />
        <Route path="/login" element={<NewLogin handleRouteChange={handleRouteChange} />} />
        <Route path='/signup' element={<SignUpTypePopUp handleRouteChange={handleRouteChange} />} />
        <Route path='/signup/child' element={<ChildSignup handleRouteChange={handleRouteChange} />} />
        <Route path="/parenthub/:userId" element={<ParentHub />} />
        <Route path="/roadmap/:uid" element={<Roadmap />} />
        <Route path="/practice/:uid" element={<Practice />} />
        <Route path="/activity/:uid/:activityTitle/:activityOrder" element={<Activity />} />
        <Route path="/lessons/:uid/:language/:lessonTitle" element={<Lessons />} />
        <Route path="/ranking/:uid" element={<Ranking />} />
        <Route path="/lessonTest/:language/:title" element={<Lesson />} />
      </Routes>
    </div>
  );
}

export default App;
