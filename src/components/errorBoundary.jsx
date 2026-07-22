import React from 'react';

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

  handleReload = () => {
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
            <p className="errorStateCopy">Your locally saved resumes are unchanged. Reload the app to start a fresh editor session.</p>
            <button type="button" className="button buttonPrimary" onClick={this.handleReload}>
              Reload app
            </button>
          </section>
        </div>
      </div>
    );
  }
}
