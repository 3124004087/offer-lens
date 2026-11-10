<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ score: number }>()

// 组件是独立可复用的，不能假设上游一定洗干净了。
// 上游钳过一次，这里再兜一次，因为「谁都能给这个组件传值」
const safe = computed(() => {
  const n = Number(props.score)
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0
})

// 100 分 = 360 度，所以 1 分 = 3.6 度
const deg = computed(() => `${safe.value * 3.6}deg`)

const tone = computed(() => {
  if (safe.value >= 80) return { text: '匹配度高', color: 'var(--c-success)' }
  if (safe.value >= 60) return { text: '可以投，但要补', color: 'var(--c-primary)' }
  return { text: '差距较大', color: 'var(--c-danger)' }
})
</script>

<template>
  <div class="wrap">
    <div
      class="ring"
      role="img"
      :aria-label="`匹配度 ${safe} 分，${tone.text}`"
      :style="{ '--deg': deg, '--ring-c': tone.color }"
    >
      <!-- 挖空出来的中间圆：顺便当数字的容器，不用再加一层遮罩 -->
      <div class="hole">
        <strong class="num">{{ safe }}</strong>
        <span class="unit">分</span>
      </div>
    </div>
    <p class="hint">{{ tone.text }}</p>
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex-shrink: 0; /* 和文字并排时别被挤扁 */
}

.ring {
  position: relative;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  /* conic-gradient（锥形渐变）从 12 点方向顺时针铺：
     0 到 --deg 上色，--deg 到 360 铺底色。角度由内联的 --deg 控制 */
  background: conic-gradient(var(--ring-c) 0 var(--deg), var(--c-border) var(--deg) 360deg);
}

/* inset 就是环的粗细：数字圆外扩 9px 挖空，剩下的 9px 才是环 */
.hole {
  position: absolute;
  inset: 9px;
  display: grid;
  place-content: center;
  text-align: center;
  border-radius: 50%;
  background: var(--c-surface);
}

.num {
  font-size: 34px;
  font-weight: 600;
  line-height: 1;
  color: var(--c-text);
  /* 等宽数字：省得 88 换到 100 时整块数字左右抖动 */
  font-variant-numeric: tabular-nums;
}

.unit {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--c-text-3);
}

.hint {
  font-size: 12px;
  color: var(--c-text-2);
}
</style>
