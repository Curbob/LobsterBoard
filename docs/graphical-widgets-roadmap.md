# Graphical Widgets Roadmap

Advanced visual widgets for enhanced system monitoring and data visualization.

## 🎯 Priority 1: Core System Monitoring

### 📊 Multi-Server Health Dashboard
**Visual Style**: Horizontal stacked bars
**Data**: Multiple servers' CPU/Memory usage
**Layout**: 
```
Server 1  [████████░░] 80% CPU  [██████░░░░] 60% MEM
Server 2  [██████░░░░] 60% CPU  [████████░░] 80% MEM  
Server 3  [███░░░░░░░] 30% CPU  [██░░░░░░░░] 20% MEM
```
**Colors**: 
- Green (0-50%), Blue (50-75%), Orange (75-90%), Red (90%+)
- Consistent with existing system widget

### 🌡️ Temperature Monitor
**Visual Style**: Thermometer + circular gauge hybrid
**Data**: CPU/GPU temperature, fan speeds
**Layout**:
```
    🌡️ CPU         💨 Fan 1
   ┌──────┐      ┌────────┐
   │██████│ 65°C  │   ████ │ 2400 RPM
   │██░░░░│      │  ████  │
   └──────┘      └────────┘
```
**Colors**: 
- Blue (< 50°C), Green (50-70°C), Yellow (70-85°C), Red (85°C+)

### 📈 Network Traffic Graph  
**Visual Style**: Dual-line real-time chart
**Data**: Upload/download speeds over time
**Layout**:
```
MB/s
 5 ┤     ╭─╮
 4 ┤   ╭─╯ ╰─╮     ← Download
 3 ┤ ╭─╯     ╰─╮
 2 ┤╱         ╰─
 1 ┤             ╲ ← Upload  
 0 └─────────────────── Time
```
**Features**: 
- Rolling 5-minute window
- Peak indicators
- Hover tooltips

## 🎯 Priority 2: Advanced Monitoring

### 💾 Storage Matrix
**Visual Style**: Grid of drive representations
**Data**: Multiple drives with usage and health
**Layout**:
```
SSD1: /     HDD1: /home   SSD2: /var
[████████░] [██████░░░░]  [███░░░░░░]
480GB 89%   2TB 67%      250GB 34%
  ✅ Good    ⚠️ Warn      ✅ Good
```
**Health Indicators**:
- ✅ Green: Healthy
- ⚠️ Yellow: Warning (SMART issues)
- ❌ Red: Critical

### ⚡ Performance Radar
**Visual Style**: 6-axis radar chart
**Data**: CPU, Memory, Disk I/O, Network, Temperature, Load Average
**Layout**:
```
         CPU
          /\
   Load  /  \  Memory
        /    \
       /      \
   Temp -------- Disk I/O  
        \      /
         \    /
    Network  /
```
**Features**:
- Current values vs. normal ranges
- Filled area showing current state
- Gridlines for reference values

### 🔋 24-Hour Timeline
**Visual Style**: Horizontal timeline with stacked bars
**Data**: Resource usage over 24 hours
**Layout**:
```
    0h  4h  8h  12h 16h 20h 24h
CPU ████████████████████████████
MEM ██████████████████████░░░░░░
DSK ████████░░░░░░░░░░████████░░
NET ████░░████░░░░████████████░░
```
**Colors**: Stacked bars with transparency
**Features**: Hover for exact time/values

## 🎯 Priority 3: Specialized Widgets

### 🌊 Resource Flow Diagram
**Visual Style**: Sankey diagram showing resource flow
**Data**: Process CPU/Memory consumption
**Use Case**: Top 5 processes visualized by resource usage

### 📡 Service Status Grid
**Visual Style**: Grid of status indicators
**Data**: Services, Docker containers, APIs
**Layout**: Traffic light grid with service names

### 🎨 Custom Metric Visualizer
**Visual Style**: User-configurable chart types
**Data**: Any numeric data source
**Features**: Choose from line, bar, gauge, pie charts

## 🔧 Technical Implementation

### Shared Components
```javascript
// Reusable legend component
function createLegend(items, position = 'right') {
  return `<div class="widget-legend widget-legend-${position}">
    ${items.map(item => `
      <div class="legend-item">
        <span class="legend-color" style="background: ${item.color}"></span>
        <span class="legend-label">${item.label}</span>
      </div>
    `).join('')}
  </div>`;
}

// Animated progress rings
function createProgressRing(percentage, size = 60, strokeWidth = 4) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100 * circumference);
  
  return `<svg width="${size}" height="${size}" class="progress-ring">
    <circle cx="${size/2}" cy="${size/2}" r="${radius}" 
            stroke="var(--bg-tertiary)" stroke-width="${strokeWidth}" fill="none"/>
    <circle cx="${size/2}" cy="${size/2}" r="${radius}"
            stroke="var(--accent-blue)" stroke-width="${strokeWidth}" fill="none"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            transform="rotate(-90 ${size/2} ${size/2})" class="progress-ring-bar"/>
  </svg>`;
}

// Real-time line charts
function createLineChart(data, width = 200, height = 80) {
  const max = Math.max(...data);
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - (value / max) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return `<svg width="${width}" height="${height}" class="line-chart">
    <polyline points="${points}" stroke="var(--accent-blue)" 
              stroke-width="2" fill="none"/>
  </svg>`;
}
```

### Color Themes
```css
/* Consistent color scheme for all graphical widgets */
.widget-graphical {
  --health-excellent: #34a853;  /* Green */
  --health-good: #4285f4;       /* Blue */  
  --health-warning: #ff9800;    /* Orange */
  --health-critical: #ea4335;   /* Red */
  --health-unknown: #6e7681;    /* Gray */
}

/* Accessibility-friendly alternatives */
.widget-graphical.colorblind-safe {
  --health-excellent: #2e8b57;  /* Sea Green */
  --health-good: #4169e1;       /* Royal Blue */
  --health-warning: #ff8c00;    /* Dark Orange */
  --health-critical: #dc143c;   /* Crimson */
}
```

### Data Sources
- **System stats**: Existing `/stats` endpoint
- **Network data**: New `/network-history` endpoint  
- **Temperature**: Platform-specific sensors
- **Disk health**: SMART data via `systeminformation`
- **Processes**: Top processes by resource usage

## 🚀 Implementation Timeline

**Phase 1 (Next)**: Fix legend display issue in current System (Graphical) widget
**Phase 2**: Multi-Server Health Dashboard
**Phase 3**: Temperature Monitor  
**Phase 4**: Network Traffic Graph
**Phase 5**: Storage Matrix
**Phase 6**: Performance Radar
**Phase 7**: 24-Hour Timeline

Each widget will be thoroughly tested for:
- Theme compatibility (dark/light modes)
- Responsive design
- Performance impact
- Data accuracy
- User experience