import { useState, useEffect, useCallback, useMemo } from 'react'
import './App.css'
import { useWebSocket } from './hooks/useWebSocket'
import { useGameSync } from './hooks/useGameSync'
import { useKeyboardControls } from './hooks/useKeyboardControls'
import { useSessionStorage } from './hooks/useSessionStorage'
import { useGameStore } from './stores/gameStore'
import { RadarDisplay } from './components/RadarDisplay'
import { ControlPanel } from './components/ControlPanel'
import { SpeedControl } from './components/SpeedControl'
import { SpawnControl } from './components/SpawnControl'
import { ChaosPanel } from './components/ChaosPanel'
import { NotificationPanel } from './components/NotificationPanel'
import { ResetConfirmationModal } from './components/ResetConfirmationModal'
import { LoginScreen } from './components/LoginScreen'
import { QueueScreen } from './components/QueueScreen'
import { GameFullScreen } from './components/GameFullScreen'
import { GameEndModal } from './components/GameEndModal'
import { ChaosAlert } from './components/ChaosAlert'
import { GameEndData } from 'shared'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  // Use sessionStorage for credentials (persists across game restarts, cleared when tab closes)
  const [username, setUsername] = useSessionStorage<string>('atc_username', '')
  const [email, setEmail] = useSessionStorage<string>('atc_email', '')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [showResetModal, setShowResetModal] = useState(false)

  // Queue state
  const [isInQueue, setIsInQueue] = useState(false)
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [totalInQueue, setTotalInQueue] = useState<number | null>(null)
  const [activePlayerCount, setActivePlayerCount] = useState<number | null>(null)
  const [gameFullMessage, setGameFullMessage] = useState<string | null>(null)

  // Game end state
  const [gameEndData, setGameEndData] = useState<GameEndData | null>(null)
  const [gameEndCountdown, setGameEndCountdown] = useState(5)

  // Chaos alert state
  const [chaosAlertName, setChaosAlertName] = useState<string | null>(null)
  const [chaosAlertDescription, setChaosAlertDescription] = useState<string | null>(null)

  // Auto-authenticate on mount if credentials exist in sessionStorage
  useEffect(() => {
    if (username && email && !isAuthenticated) {
      setIsAuthenticated(true)
    }
  }, [username, email, isAuthenticated])

  // Always call hook, but only enable WebSocket after authentication
  const { socket, isConnected, connectionError } = useWebSocket(isAuthenticated)

  // Get addEvent from store (needed for queue callbacks)
  const addEvent = useGameStore((state) => state.addEvent)

  // Memoized error handler to prevent infinite re-renders
  const handleJoinError = useCallback((error: string) => {
    // Handle join errors (username taken, profanity, etc.)
    setLoginError(error)
    setIsAuthenticated(false)
  }, [])

  // Queue callbacks
  const queueCallbacks = useMemo(() => ({
    onQueueJoined: (data: { position: number; totalInQueue: number; activePlayerCount: number }) => {
      setIsInQueue(true)
      setQueuePosition(data.position)
      setTotalInQueue(data.totalInQueue)
      setActivePlayerCount(data.activePlayerCount)
      setGameFullMessage(null)
    },
    onQueuePositionUpdated: (data: { position: number }) => {
      setQueuePosition(data.position)
    },
    onPromotedFromQueue: () => {
      setIsInQueue(false)
      setQueuePosition(null)
      setTotalInQueue(null)
      setActivePlayerCount(null)
    },
    onGameFull: (data: { message: string }) => {
      setGameFullMessage(data.message)
      setIsInQueue(false)
    },
    onPlayerEnteredGame: (data: { username: string; playerId: string }) => {
      addEvent({
        id: `player-entered-${data.playerId}-${Date.now()}`,
        type: 'player_entered',
        timestamp: Date.now(),
        aircraftIds: [],
        controllerId: data.playerId,
        message: `Controller ${data.username} joined the airspace`,
        severity: 'info'
      })
    },
    onPlayerLeftGame: (data: { username: string; playerId: string }) => {
      addEvent({
        id: `player-left-${data.playerId}-${Date.now()}`,
        type: 'player_left',
        timestamp: Date.now(),
        aircraftIds: [],
        controllerId: data.playerId,
        message: `Controller ${data.username} left the airspace`,
        severity: 'info'
      })
    },
    onGameEnded: (data: GameEndData) => {
      setGameEndData(data)
      setGameEndCountdown(5)
    },
    onGameRestarting: (_data: { message: string }) => {
      // Game is restarting - keep authentication, auto-rejoin queue
      setGameEndData(null)
      setGameEndCountdown(5)
      // Note: isAuthenticated remains true, credentials preserved in sessionStorage
      // The useGameSync hook will automatically rejoin the queue
    },
    onReturnToLogin: (_data: { message: string }) => {
      // Explicit logout/disconnect - return to login screen
      setIsAuthenticated(false)
      setGameEndData(null)
      setGameEndCountdown(5)
      setIsInQueue(false)
      setQueuePosition(null)
    },
    onAutoChaosActivated: (data: { chaosName: string; chaosDescription: string }) => {
      setChaosAlertName(data.chaosName)
      setChaosAlertDescription(data.chaosDescription)
    },
  }), [addEvent])

  const { sendCommand, setTimeScale, sendChaosCommand, spawnAircraft, resetGame } = useGameSync(
    socket,
    isConnected,
    username,
    email,
    handleJoinError,
    queueCallbacks
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

  // Game end countdown timer
  useEffect(() => {
    if (gameEndData && gameEndCountdown > 0) {
      const timer = setInterval(() => {
        setGameEndCountdown((prev) => prev - 1)
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [gameEndData, gameEndCountdown])

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

  // Show game full screen if game is full
  if (gameFullMessage) {
    return (
      <GameFullScreen
        message={gameFullMessage}
        activePlayerCount={activePlayerCount || 0}
        onRetry={() => {
          setGameFullMessage(null)
          setIsAuthenticated(false)
        }}
      />
    )
  }

  // Show queue screen if in queue
  if (isInQueue && queuePosition !== null) {
    return (
      <QueueScreen
        position={queuePosition}
        totalInQueue={totalInQueue || 0}
        activePlayerCount={activePlayerCount || 0}
      />
    )
  }

  // Show game UI when authenticated and in game
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
      <GameEndModal
        gameEndData={gameEndData}
        countdown={gameEndCountdown}
      />
      <ChaosAlert
        chaosName={chaosAlertName}
        chaosDescription={chaosAlertDescription}
      />
    </div>
  )
}

export default App
