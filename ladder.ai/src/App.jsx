import MorphingWaveToSphere from './components/final';

function App() {
  return (
    <div className="App">
      {/* Background particle effect */}
      <MorphingWaveToSphere />
      
      {/* Scrollable content - creates scroll height for the transition */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <section style={{ height: '100vh' }} />
        <section style={{ height: '100vh' }} />
        <section style={{ height: '100vh' }} />
      </div>
    </div>
  );
}

export default App; 