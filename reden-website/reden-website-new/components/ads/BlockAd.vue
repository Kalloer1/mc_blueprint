<script lang="ts" setup>
import GoogleAd from '~/components/ads/GoogleAd.vue';
</script>

<template>
  <div class="limited">
    <div class="limited">
      <google-ad>
        <ins
          class="adsbygoogle"
          data-ad-client="ca-pub-4957320708232906"
          data-ad-format="fluid"
          data-ad-layout-key="-6t+ed+2i-1n-4w"
          data-ad-slot="5905130073"
          style="display: block"
        />
      </google-ad>
    </div>
  </div>
</template>
<style scoped>
.limited {
  height: 330px;
  max-height: 330px;
  overflow: hidden;
}
</style>
