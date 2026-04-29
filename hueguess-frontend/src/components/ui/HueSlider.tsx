interface HueSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function HueSlider({ value, onChange }: HueSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-text-muted">Hue</label>
        <span className="text-sm font-mono text-text-deep">{Math.round(value)}°</span>
      </div>
      <div className="relative">
        <input
        title="Hue"
          type="range"
          min="0"
          max="360"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
          style={{
            background: `linear-gradient(to right, 
              hsl(0, 100%, 50%),
              hsl(60, 100%, 50%),
              hsl(120, 100%, 50%),
              hsl(180, 100%, 50%),
              hsl(240, 100%, 50%),
              hsl(300, 100%, 50%),
              hsl(360, 100%, 50%)
            )`,
            height: '16px',
            borderRadius: '12px',
          }}
        />
        {/* Glossy highlight */}
        <div className="absolute inset-0 rounded-slider bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}