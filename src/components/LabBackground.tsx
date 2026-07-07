
import React from 'react';
import { Microscope, Beaker, Atom, Dna as DnaIcon, FlaskConical, FlaskRound, TestTube2, TestTubes, Pipette, Thermometer, Biohazard, Activity } from 'lucide-react';

export default function LabBackground() {
  const icons = [
    Microscope, Beaker, Atom, DnaIcon, FlaskConical, FlaskRound, TestTube2, TestTubes, Pipette, Thermometer, Biohazard, Activity
  ];

  // Distribute icons using a strictly static grid-based distribution (watermark style)
  const pattern = React.useMemo(() => {
    const rows = 7;
    const cols = 9;
    const cells: { Icon: any, top: string, left: string, rotate: number, size: number }[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const top = (r / rows) * 100 + (100 / rows / 2);
        const left = (c / cols) * 100 + (100 / cols / 2);
        
        const index = r * cols + c;
        // Deterministic placement without random jitter
        cells.push({
          Icon: icons[index % icons.length],
          top: `${top}%`,
          left: `${left}%`,
          rotate: (index * 45) % 360,
          size: 28 + (index % 3) * 14
        });
      }
    }
    return cells;
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden opacity-[0.25] dark:opacity-[0.35]">
      {pattern.map((item, i) => (
        <div
          key={i}
          className={`absolute ${
            i % 4 === 0 ? "text-brand-green/90" : 
            i % 6 === 0 ? "text-lab-cyan/90" : 
            "text-slate-600/50 dark:text-slate-400/40"
          }`}
          style={{
            top: item.top,
            left: item.left,
            transform: `translate(-50%, -50%) rotate(${item.rotate}deg)`,
          }}
        >
          <item.Icon size={item.size} strokeWidth={1.2} />
        </div>
      ))}
    </div>
  );
}
