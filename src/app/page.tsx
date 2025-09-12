"use client";

import React, { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Check if user has been to config before, if not redirect to config
    const hasConfig = localStorage.getItem('dinstar_config');
    if (!hasConfig) {
      // First time - redirect to config page
      window.location.href = '/sms-config';
    } else {
      // Has config - redirect to SMS messages
      window.location.href = '/sms-messages';
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Duke ngarkuar SMS Module...</p>
      </div>
    </div>
  );
}