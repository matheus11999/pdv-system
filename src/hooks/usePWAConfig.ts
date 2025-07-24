import { useEffect } from 'react';
import { useStoreSettings } from './useStoreSettings';
import { updatePWAManifest } from '../utils/pwaUtils';

export const usePWAConfig = () => {
  const { settings } = useStoreSettings();

  useEffect(() => {
    if (settings) {
      // Update PWA manifest with store settings
      updatePWAManifest({
        pwa_name: settings.pwa_name || 'PDV - Sistema de Vendas',
        pwa_short_name: settings.pwa_short_name || 'PDV System',
        pwa_description: settings.pwa_description || 'Sistema completo de Ponto de Venda com controle de estoque',
        pwa_theme_color: settings.pwa_theme_color || '#2563eb',
        pwa_background_color: settings.pwa_background_color || '#ffffff',
        pwa_icon_url: settings.pwa_icon_url
      });

      // Update document title
      document.title = settings.pwa_name || 'PDV - Sistema de Ponto de Venda';
      
      // Update meta description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', settings.pwa_description || 'Sistema completo de Ponto de Venda com controle de estoque');
      }
    }
  }, [settings]);

  return { settings };
};