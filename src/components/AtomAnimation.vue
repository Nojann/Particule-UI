<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'

interface Orbit {
  /** Rotation of the orbit, in degrees */
  tilt: number
  rx: number
  ry: number
  /** Duration of one revolution, in seconds */
  period: number
  /** Starting position of the orbit's first particle, chosen so none overlap when frozen */
  phase: number
}

interface Particle {
  id: number
  orbit: number
  /** Starting position on the orbit, from 0 to 1 */
  phase: number
}

const ORBITS: Orbit[] = [
  { tilt: -30, rx: 80, ry: 28, period: 6, phase: 0 },
  { tilt: 30, rx: 80, ry: 28, period: 8, phase: 0.35 },
  { tilt: 90, rx: 80, ry: 28, period: 10, phase: 0.1 },
]
const MAX_PARTICLES = 9
const HOVER_SPEED = 3
/** Must match the duration of the `emit` animation in the styles */
const EMIT_MS = 700

const root = useTemplateRef<HTMLButtonElement>('root')
const orbitGlows = useTemplateRef<SVGEllipseElement[]>('orbitGlows')
const reducedMotion = usePreferredReducedMotion()

let nextId = 0
function createParticle(orbit: number, phase = Math.random()): Particle {
  return { id: nextId++, orbit, phase }
}

const particles = ref<Particle[]>(ORBITS.map((orbit, index) => createParticle(index, orbit.phase)))

// The orbit is an ellipse traced by two eased back-and-forth translations, x and y a quarter
// revolution apart (x = -rx·cos, y = ry·sin). Unlike scaling a circle, the particle stays round.
function particleStyle({ orbit, phase }: Particle) {
  const { rx, ry, period } = ORBITS[orbit]!
  const delay = -phase * period
  return {
    '--rx': `${rx}px`,
    '--ry': `${ry}px`,
    '--half-period': `${period / 2}s`,
    '--delay-x': `${delay}s`,
    '--delay-y': `${delay - period / 4}s`,
  }
}

// Speed: ramp the playback rate of the CSS orbit animations, which keeps every particle where it is
// (changing animation-duration instead would make them jump)
let rate = 1
let targetRate = 1
let frame = 0

function orbitAnimations() {
  const element = root.value
  if (!element || typeof element.getAnimations !== 'function') return []
  return element
    .getAnimations({ subtree: true })
    .filter(
      (animation): animation is CSSAnimation =>
        'animationName' in animation &&
        (animation as CSSAnimation).animationName.startsWith('orbit'),
    )
}

function applyRate() {
  for (const animation of orbitAnimations()) animation.playbackRate = rate
}

function rampRate() {
  rate += (targetRate - rate) * 0.08
  if (Math.abs(targetRate - rate) < 0.01) rate = targetRate
  applyRate()
  frame = rate === targetRate ? 0 : requestAnimationFrame(rampRate)
}

function setSpeed(value: number) {
  if (reducedMotion.value === 'reduce') return
  targetRate = value
  if (!frame) frame = requestAnimationFrame(rampRate)
}

// The orbit receiving a particle lights up as the particle reaches it
function glowOrbit(orbit: number) {
  const glow = orbitGlows.value?.[orbit]
  if (!glow || typeof glow.animate !== 'function' || reducedMotion.value === 'reduce') return
  glow.animate([{ opacity: 0 }, { opacity: 0.8, offset: 0.3 }, { opacity: 0 }], {
    duration: 900,
    delay: EMIT_MS * 0.6,
    easing: 'ease-out',
  })
}

// Click: emit a particle from the nucleus onto the next orbit; once full, the oldest one fades out
async function onClick() {
  const orbit = nextId % ORBITS.length
  if (particles.value.length >= MAX_PARTICLES) particles.value.shift()
  particles.value.push(createParticle(orbit))
  glowOrbit(orbit)

  // New particles start at the default speed: align them with the current one
  await nextTick()
  applyRate()
}

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <button
    ref="root"
    type="button"
    aria-label="Ajouter une particule"
    class="aspect-square w-full max-w-sm cursor-pointer rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    @pointerenter="setSpeed(HOVER_SPEED)"
    @pointerleave="setSpeed(1)"
    @click="onClick"
  >
    <svg viewBox="-100 -100 200 200" aria-hidden="true" class="size-full overflow-visible">
      <g v-for="(orbit, index) in ORBITS" :key="index" :transform="`rotate(${orbit.tilt})`">
        <ellipse
          :rx="orbit.rx"
          :ry="orbit.ry"
          class="fill-none stroke-muted-foreground/50"
          stroke-width="1"
        />
        <ellipse
          ref="orbitGlows"
          :rx="orbit.rx"
          :ry="orbit.ry"
          class="fill-none stroke-foreground"
          stroke-width="1.5"
          opacity="0"
        />
      </g>

      <circle class="fill-primary" r="7" />

      <TransitionGroup
        tag="g"
        leave-active-class="transition-opacity duration-500"
        leave-to-class="opacity-0"
      >
        <g
          v-for="particle in particles"
          :key="particle.id"
          :transform="`rotate(${ORBITS[particle.orbit]!.tilt})`"
          :style="particleStyle(particle)"
        >
          <g class="emit">
            <g class="orbit-x">
              <g class="orbit-y">
                <circle class="fill-primary" r="4" />
              </g>
            </g>
          </g>
        </g>
      </TransitionGroup>
    </svg>

    <span class="sr-only" aria-live="polite">{{ particles.length }} particules</span>
  </button>
</template>

<style scoped>
/* easeInOutSine: the back-and-forth translations follow a sine, so the path is a true ellipse */
.orbit-x {
  animation: orbit-x var(--half-period) cubic-bezier(0.37, 0, 0.63, 1) var(--delay-x) infinite
    alternate;
}

.orbit-y {
  animation: orbit-y var(--half-period) cubic-bezier(0.37, 0, 0.63, 1) var(--delay-y) infinite
    alternate;
}

@keyframes orbit-x {
  from {
    transform: translateX(calc(-1 * var(--rx)));
  }
  to {
    transform: translateX(var(--rx));
  }
}

@keyframes orbit-y {
  from {
    transform: translateY(calc(-1 * var(--ry)));
  }
  to {
    transform: translateY(var(--ry));
  }
}

/* Emission: the particle's orbit is scaled up from the nucleus while it already travels along it,
   so it spirals out of the nucleus and lands on its orbit, growing to full size */
.emit {
  transform-box: view-box;
  transform-origin: 0 0;
  animation: emit 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes emit {
  from {
    transform: scale(0);
  }
}

/* Paused rather than removed: each particle stays frozen at its own spot on its orbit */
@media (prefers-reduced-motion: reduce) {
  .orbit-x,
  .orbit-y {
    animation-play-state: paused;
  }

  .emit {
    animation: none;
  }
}
</style>
