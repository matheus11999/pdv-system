export const updatePWAManifest = (settings: {
  pwa_name: string;
  pwa_short_name: string;
  pwa_description: string;
  pwa_theme_color: string;
  pwa_background_color: string;
  pwa_icon_url?: string;
}) => {
  const manifest = {
    name: settings.pwa_name || 'PDV - Sistema de Ponto de Venda',
    short_name: settings.pwa_short_name || 'PDV System',
    description: settings.pwa_description || 'Sistema completo de Ponto de Venda com controle de estoque',
    start_url: '/',
    display: 'standalone',
    background_color: settings.pwa_background_color || '#ffffff',
    theme_color: settings.pwa_theme_color || '#2563eb',
    orientation: 'portrait-primary',
    icons: [
      {
        src: settings.pwa_icon_url || '/icon-192.svg',
        sizes: '192x192',
        type: settings.pwa_icon_url ? 'image/png' : 'image/svg+xml',
        purpose: 'any maskable'
      },
      {
        src: settings.pwa_icon_url || '/icon-512.svg',
        sizes: '512x512',
        type: settings.pwa_icon_url ? 'image/png' : 'image/svg+xml',
        purpose: 'any maskable'
      }
    ],
    categories: ['business', 'productivity', 'finance'],
    lang: 'pt-BR'
  };

  // Update manifest link in head
  updateManifestLink(manifest);
  
  return manifest;
};

const updateManifestLink = (manifest: any) => {
  // Create blob URL for dynamic manifest
  const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: 'application/json'
  });
  const manifestURL = URL.createObjectURL(manifestBlob);
  
  // Find existing manifest link or create new one
  let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
  
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }
  
  // Update href to dynamic manifest
  manifestLink.href = manifestURL;
  
  // Update meta theme-color
  let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    document.head.appendChild(themeColorMeta);
  }
  themeColorMeta.content = manifest.theme_color;
};

export const checkPWAInstallability = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // Check if PWA is already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      resolve(true);
      return;
    }
    
    // Check for beforeinstallprompt event support
    let deferredPrompt: any = null;
    
    window.addEventListener('beforeinstallprompt', (e) => {
      deferredPrompt = e;
      resolve(true);
    });
    
    // Timeout after 3 seconds
    setTimeout(() => {
      resolve(deferredPrompt !== null);
    }, 3000);
  });
};