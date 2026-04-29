import { hslToString } from '@/lib/utils';

interface LightnessSliderProps {
  value: number;
  hue: number;
  saturation: number;
  onChange: (value: number) => void;
}

export function LightnessSlider({ value, hue, saturation, onChange }: LightnessSliderProps) {
  const leftColor = hslToString(hue, saturation, 0);
  const rightColor = hslToString(hue, saturation, 100);
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-text-muted">Brightness</label>
        <span className="text-sm font-mono text-text-deep">{Math.round(value)}%</span>
      </div>
      <div className="relative">
        <input
          title="Brightness"
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
          style={{
            background: `linear-gradient(to right, ${leftColor}, ${rightColor})`,
            height: '16px',
            borderRadius: '12px',
          }}
        />
        <div className="absolute inset-0 rounded-slider bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}