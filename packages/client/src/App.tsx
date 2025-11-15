import { useState, useEffect } from 'react'
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

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const { socket, isConnected, connectionError } = useWebSocket()
  const { sendCommand, setTimeScale, sendChaosCommand, spawnAircraft } = useGameSync(socket, isConnected)

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

  // Enable keyboard controls for selected aircraft
  useKeyboardControls({
    selectedAircraft,
    allAircraft: aircraftArray,
    onCommand: sendCommand,
    onSelectAircraft: setSelectedAircraft,
  })

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
    </div>
  )
}

export default App
