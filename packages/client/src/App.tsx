import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { useWebSocket } from './hooks/useWebSocket'
import { useGameSync } from './hooks/useGameSync'
import { useKeyboardControls } from './hooks/useKeyboardControls'
import { useGameStore } from './stores/gameStore'
import { RadarDisplay } from './components/RadarDisplay'
import { ControlPanel } from './components/ControlPanel'
import { SpeedControl } from './components/SpeedControl'
import { SpawnControl } from './components/SpawnControl'
import { ChaosPanel } from './components/ChaosPanel'
import { NotificationPanel } from './components/NotificationPanel'
import { ResetConfirmationModal } from './components/ResetConfirmationModal'
import { LoginScreen } from './components/LoginScreen'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [showResetModal, setShowResetModal] = useState(false)

  // Always call hook, but only enable WebSocket after authentication
  const { socket, isConnected, connectionError } = useWebSocket(isAuthenticated)

  // Memoized error handler to prevent infinite re-renders
  const handleJoinError = useCallback((error: string) => {
    // Handle join errors (username taken, profanity, etc.)
    setLoginError(error)
    setIsAuthenticated(false)
  }, [])

  const { sendCommand, setTimeScale, sendChaosCommand, spawnAircraft, resetGame } = useGameSync(
    socket,
    isConnected,
    username,
    email,
    handleJoinError
  )

  const gameState = useGameStore((state) => state.gameState)
  const selectedAircraftId = useGameStore((state) => state.selectedAircraftId)
  const setSelectedAircraft = useGameStore((state) => state.setSelectedAircraft)

  // Convert aircraft object to array
  const aircraftArray = gameState ? Object.values(gameState.aircraft) : []

  // Get airports, waypoints, weather, and events
  const airports = gameState?.airspace?.airports || []
  const waypoints = gameState?.airspace?.waypoints || []
  const weather = gameState?.airspace?.weather || []
  const events = gameState?.recentEvents || []
  const currentSpeed = gameState?.timeScale || 10
  const chaosAbilities = gameState?.chaosAbilities || {}

  // Get selected aircraft object
  const selectedAircraft = selectedAircraftId && gameState
    ? gameState.aircraft[selectedAircraftId]
    : null

  // Enable keyboard controls for selected aircraft (only when authenticated)
  useKeyboardControls({
    selectedAircraft,
    allAircraft: aircraftArray,
    onCommand: sendCommand,
    onSelectAircraft: setSelectedAircraft,
  })

  // Handle login
  const handleLogin = (newUsername: string, newEmail: string) => {
    setUsername(newUsername)
    setEmail(newEmail)
    setLoginError(null)
    setIsAuthenticated(true)
  }

  // Admin reset keyboard shortcut: Ctrl+Shift+Alt+R (Windows/Linux) or Cmd+Shift+Alt+R (Mac)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifierKey = e.ctrlKey || e.metaKey; // metaKey is Cmd on Mac, Win key on Windows

      // Check for reset shortcut (case-insensitive, also check e.code for reliability)
      const isResetKey = e.key.toLowerCase() === 'r' || e.code === 'KeyR';
      if (modifierKey && e.shiftKey && e.altKey && isResetKey) {
        e.preventDefault()
        setShowResetModal(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleResetConfirm = () => {
    resetGame()
    setShowResetModal(false)
  }

  const handleResetCancel = () => {
    setShowResetModal(false)
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />
  }

  // Show game UI when authenticated
  return (
    <div className="app">
      <div className="header">
        UNHINGED ATC - CROWDSOURCED AIR TRAFFIC CONTROL
        <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.8 }}>
          {isConnected ? (
            <span style={{ color: '#00FF00' }}>● CONNECTED</span>
          ) : connectionError ? (
            <span style={{ color: '#FF0000' }}>● ERROR: {connectionError}</span>
          ) : (
            <span style={{ color: '#FFAA00' }}>● CONNECTING...</span>
          )}
        </div>
      </div>
      <div className="game-container">
        <div className="radar-section">
          <RadarDisplay
            aircraft={aircraftArray}
            airports={airports}
            waypoints={waypoints}
            weather={weather}
            events={events}
            selectedAircraftId={selectedAircraftId}
            onAircraftSelect={(id) => setSelectedAircraft(id || null)}
            score={gameState?.score}
            planesCleared={gameState?.planesCleared}
            crashCount={gameState?.crashCount}
            gameTime={gameState?.gameTime}
            nextBonusAt={gameState?.nextBonusAt}
          />
        </div>
        <div className="control-section">
          <SpeedControl
            currentSpeed={currentSpeed}
            onSpeedChange={setTimeScale}
          />
          <SpawnControl
            onSpawnAircraft={spawnAircraft}
          />
          <ChaosPanel
            chaosAbilities={chaosAbilities}
            onChaosCommand={sendChaosCommand}
          />
          <ControlPanel
            selectedAircraft={selectedAircraft}
            onCommand={sendCommand}
          />
          <NotificationPanel />
        </div>
      </div>
      <div className="scanline"></div>
      <ResetConfirmationModal
        isOpen={showResetModal}
        onConfirm={handleResetConfirm}
        onCancel={handleResetCancel}
      />
    </div>
  )
}

export default App
