<script lang="ts" setup>
import GoogleAd from '~/components/ads/GoogleAd.vue';

const props = defineProps({
  height: {
    type: Number,
    default: 150,
  },
});
</script>

<template>
  <google-ad>
    <ins
      class="adsbygoogle"
      data-ad-client="ca-pub-4957320708232906"
      data-ad-format="fluid"
      data-ad-layout-key="-6t+ed+2i-1n-4w"
      data-ad-slot="5306364279"
      :style="`width: 100%; height: ${height}px;`"
    />
  </google-ad>
</template>

<style scoped>
.adsbygoogle,
:deep(.adsbygoogle) {
  display: flex;
  flex-direction: row;
  justify-content: center;
  margin: auto;
  max-height: 200px;
  height: 200px;
}
</style>
