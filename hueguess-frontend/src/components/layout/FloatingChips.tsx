export function FloatingChips() {
  const chips = [
    { color: 'hsl(245, 82%, 58%)', size: 40, x: '10%', y: '20%', anim: 'float' },
    { color: 'hsl(30, 90%, 60%)', size: 30, x: '80%', y: '30%', anim: 'float-delayed' },
    { color: 'hsl(150, 70%, 50%)', size: 50, x: '20%', y: '70%', anim: 'float-slow' },
    { color: 'hsl(320, 80%, 65%)', size: 25, x: '70%', y: '60%', anim: 'float' },
    { color: 'hsl(60, 85%, 55%)', size: 35, x: '50%', y: '15%', anim: 'float-delayed' },
    { color: 'hsl(200, 75%, 60%)', size: 45, x: '90%', y: '80%', anim: 'float-slow' },
  ];
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {chips.map((chip, i) => (
        <div
          key={i}
          className={`absolute rounded-full opacity-[0.06] blur-2xl animate-${chip.anim}`}
          style={{
            backgroundColor: chip.color,
            width: chip.size,
            height: chip.size,
            left: chip.x,
            top: chip.y,
          }}
        />
      ))}
    </div>
  );
}