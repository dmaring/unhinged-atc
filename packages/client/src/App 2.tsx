import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate initialization
    setTimeout(() => setIsLoading(false), 1000)
  }, [])

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading">
          INITIALIZING UNHINGED ATC SYSTEM...
        </div>
        <div className="scanline"></div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        UNHINGED ATC - CROWDSOURCED AIR TRAFFIC CONTROL
      </div>
      <div className="game-container">
        <div className="radar-section">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontSize: '18px',
            textAlign: 'center',
            padding: '20px'
          }}>
            RADAR DISPLAY<br />
            <small style={{ fontSize: '12px', opacity: 0.7 }}>
              (Building radar canvas component...)
            </small>
          </div>
        </div>
        <div className="control-section">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontSize: '18px',
            textAlign: 'center',
            padding: '20px'
          }}>
            CONTROL PANEL<br />
            <small style={{ fontSize: '12px', opacity: 0.7 }}>
              (Building control components...)
            </small>
          </div>
        </div>
      </div>
      <div className="scanline"></div>
    </div>
  )
}

export default App
