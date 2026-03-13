import React from 'react';
import { DRAFT_STORAGE_KEY } from '../lib/resume.js';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('ResumeLoomr render error:', error);
  }

  handleReset = () => {
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage failures and still reload.
    }

    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="app">
        <div className="appShell">
          <section className="panel errorState">
            <p className="kicker">Recovery</p>
            <h1>Something went wrong while loading the editor.</h1>
            <p className="errorStateCopy">Your latest draft may still be recoverable, but the safest next step is to reset the broken session and reload the app.</p>
            <button type="button" className="button buttonPrimary" onClick={this.handleReset}>
              Reset and reload
            </button>
          </section>
        </div>
      </div>
    );
  }
}
