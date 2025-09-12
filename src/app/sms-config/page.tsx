"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
// Dinstar configuration interface based on working example
interface DinstarConfig {
  baseUrl: string;
  username: string;
  password: string;
  port: number; // Web interface port (usually 8080 or 443)
  serialNumber: string; // SN parameter required by Dinstar
  fromNumber: string;
  encoding: 'utf8' | 'ucs2' | 'latin1';
  timeout: number;
  // SIM port configuration based on Dinstar API
  simPort: number; // Port number for specific SIM card
  simPorts: SimPortConfig[]; // Available SIM ports
}

interface SimPortConfig {
  port: number;
  simNumber: string;
  status: 'active' | 'inactive' | 'error';
  operator: string;
  signal: number;
}

export default function SmsConfig() {
   const [config, setConfig] = useState<DinstarConfig>({
    baseUrl: 'https://192.168.1.100',
    username: '',
    password: '',
    port: 443, // HTTPS port for Dinstar
    serialNumber: '', // Serial number required by Dinstar
    fromNumber: '', // Will be auto-filled from selected SIM port
    encoding: 'utf8',
    timeout: 30,
    simPort: 0, // Default SIM port (0-based indexing)
    simPorts: [] // Will be loaded from gateway
  });

  const [status, setStatus] = useState<'offline' | 'online' | 'testing'>('offline');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingPorts, setLoadingPorts] = useState(false);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      // Simulate loading from localStorage or API
      const savedConfig = localStorage.getItem('dinstar_config');
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
        // Test connection automatically
        testConnection(JSON.parse(savedConfig));
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
       // Validate configuration
      if (!config.baseUrl || !config.username || !config.password || !config.serialNumber) {
        alert('Ju lutem plotësoni të gjitha fushat e kërkuara');
        return;
      }

      // Save to localStorage (in real app, this would be saved to database)
      localStorage.setItem('dinstar_config', JSON.stringify(config));
      
      // Test connection after saving
      await testConnection(config);
      
      alert('Konfigurimi u ruajt me sukses!');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert('Gabim në ruajtjen e konfigurimit');
    } finally {
      setSaving(false);
    }
  };

  const loadSimPorts = async () => {
    setLoadingPorts(true);
    try {
      // Call to get SIM port status from Dinstar API
      const response = await fetch('/api/dinstar/sim-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          port: config.port,
          username: config.username,
          password: config.password
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        const simPorts: SimPortConfig[] = result.data.ports || [];
        setConfig(prev => ({ ...prev, simPorts }));
        
        // Auto-select first active port if none selected
        if (simPorts.length > 0 && !config.simPort) {
          const activePort = simPorts.find(p => p.status === 'active');
          if (activePort) {
            setConfig(prev => ({ ...prev, simPort: activePort.port, fromNumber: activePort.simNumber }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load SIM ports:', error);
    } finally {
      setLoadingPorts(false);
    }
  };

   const testBasicConnection = async () => {
    setTesting(true);
    setStatus('testing');
    
    try {
      const response = await fetch('/api/dinstar/test-basic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Gateway është i arritshëm!\n\nURL: ${result.data.url}\nStatus: ${result.data.status}\n\nTani mund të testoni API authentication.`);
        setStatus('online');
      } else {
        alert(`❌ Gateway nuk është i arritshëm:\n${result.message}\n\n${result.debug?.suggestion || ''}`);
        setStatus('offline');
      }
    } catch (error) {
      console.error('Basic connection test failed:', error);
      setStatus('offline');
      alert('Gabim në testimin bazik të lidhjes.');
    } finally {
      setTesting(false);
    }
  };

  const testConnection = async (testConfig: DinstarConfig) => {
    setTesting(true);
    setStatus('testing');
    
    try {
      // Test connection to Dinstar gateway using actual API
      const response = await fetch('/api/dinstar/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testConfig),
      });

      const result = await response.json();
      console.log('Test result:', result);
      
      if (result.success) {
        setStatus('online');
        // Load SIM ports after successful connection
        await loadSimPorts();
        alert('✅ Lidhja u testua me sukses! SIM portat u ngarkuan.');
      } else {
        setStatus('offline');
        let errorMsg = `❌ Gabim në lidhje: ${result.message}`;
        
        if (result.debug) {
          errorMsg += `\n\nDetaje teknike:`;
          if (result.debug.error_code) {
            errorMsg += `\nKodi i gabimit: ${result.debug.error_code}`;
          }
          if (result.debug.suggestion) {
            errorMsg += `\nSugjerimi: ${result.debug.suggestion}`;
          }
          if (result.debug.body) {
            errorMsg += `\nPërgjigja: ${result.debug.body.substring(0, 100)}...`;
          }
        }
        
        alert(errorMsg);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setStatus('offline');
      alert('Gabim në testimin e lidhjes. Kontrolloni të dhënat.');
    } finally {
      setTesting(false);
    }
  };

  const handleInputChange = (field: keyof DinstarConfig, value: string | number) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-100 text-green-800">Online</Badge>;
      case 'testing':
        return <Badge className="bg-yellow-100 text-yellow-800">Duke testuar...</Badge>;
      case 'offline':
      default:
        return <Badge className="bg-red-100 text-red-800">Offline</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Konfigurimi i Gateway Dinstar</h1>
              <p className="text-gray-600 mt-2">Konfiguro lidhjen me gateway-n tuaj Dinstar për SMS</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">Status:</span>
              {getStatusBadge()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Form */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-gray-800">Konfigurimi i Gateway</CardTitle>
                <p className="text-sm text-gray-600">Plotësoni të dhënat për lidhjen me Dinstar Gateway</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Connection Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="baseUrl" className="text-sm font-medium text-gray-700">
                      IP Address / URL <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="baseUrl"
                      type="text"
                      placeholder="http://192.168.1.100"
                      value={config.baseUrl}
                      onChange={(e) => handleInputChange('baseUrl', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="port" className="text-sm font-medium text-gray-700">
                      Port <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder="8080"
                      value={config.port}
                      onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 8080)}
                      className="mt-1"
                    />
                  </div>
                </div>

                 {/* Authentication */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                      Username <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="admin"
                      value={config.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                      Password <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={config.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Serial Number */}
                <div>
                  <Label htmlFor="serialNumber" className="text-sm font-medium text-gray-700">
                    Serial Number (SN) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="serialNumber"
                    type="text"
                    placeholder="Gateway serial number"
                    value={config.serialNumber}
                    onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Serial number i gateway Dinstar (e nevojshme për API)
                  </p>
                </div>

                {/* SIM Port Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-700">
                      Porta SIM <span className="text-red-500">*</span>
                    </Label>
                    <Button
                      onClick={loadSimPorts}
                      disabled={loadingPorts || !config.baseUrl || !config.username || !config.password}
                      size="sm"
                      variant="outline"
                    >
                      {loadingPorts ? 'Duke ngarkuar...' : 'Ngarko Portat SIM'}
                    </Button>
                  </div>

                  {config.simPorts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {config.simPorts.map((simPort) => (
                        <div
                          key={simPort.port}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            config.simPort === simPort.port
                              ? 'border-blue-500 bg-blue-50'
                              : simPort.status === 'active'
                              ? 'border-green-300 bg-green-50 hover:border-green-400'
                              : 'border-red-300 bg-red-50'
                          }`}
                          onClick={() => {
                            if (simPort.status === 'active') {
                              handleInputChange('simPort', simPort.port);
                              handleInputChange('fromNumber', simPort.simNumber);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-800">Porta {simPort.port}</span>
                            <Badge
                              className={
                                simPort.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : simPort.status === 'error'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }
                            >
                              {simPort.status === 'active' ? 'Aktive' : 
                               simPort.status === 'error' ? 'Gabim' : 'Jo Aktive'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{simPort.simNumber}</p>
                          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                            <span>{simPort.operator}</span>
                            <span>Signal: {simPort.signal}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-600">
                      <p>Klikoni "Ngarko Portat SIM" për të parë portat e disponueshme.</p>
                      <p className="text-xs mt-2">Numri dërguesi do të caktohet automatikisht nga porta e zgjedhur.</p>
                    </div>
                  )}
                </div>

                {/* Current Selected SIM Info & SMS Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Numri Dërguesi (Automatik)
                    </Label>
                    <div className="mt-1 p-3 bg-gray-50 border border-gray-300 rounded-md">
                      <p className="text-sm text-gray-700">
                        {config.fromNumber || 'Zgjidhni një portë SIM'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {config.simPort ? `Porta SIM: ${config.simPort}` : 'Porta jo e caktuar'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Numri caktohet automatikisht nga porta SIM e zgjedhur
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="encoding" className="text-sm font-medium text-gray-700">
                      Encoding
                    </Label>
                    <Select 
                      value={config.encoding} 
                      onValueChange={(value: 'utf8' | 'ucs2' | 'latin1') => handleInputChange('encoding', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utf8">UTF-8 (Recommended)</SelectItem>
                        <SelectItem value="ucs2">UCS-2</SelectItem>
                        <SelectItem value="latin1">Latin-1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div>
                  <Label htmlFor="timeout" className="text-sm font-medium text-gray-700">
                    Connection Timeout (sekonda)
                  </Label>
                  <Input
                    id="timeout"
                    type="number"
                    placeholder="30"
                    value={config.timeout}
                    onChange={(e) => handleInputChange('timeout', parseInt(e.target.value) || 30)}
                    className="mt-1 md:w-32"
                  />
                </div>

                 {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button 
                    onClick={saveConfiguration} 
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"
                  >
                    {saving ? 'Duke ruajtur...' : 'Ruaj Konfigurimin'}
                  </Button>
                  
                  <Button 
                    onClick={testBasicConnection} 
                    disabled={testing}
                    variant="outline"
                    className="flex-1 sm:flex-none"
                  >
                    {testing ? 'Duke testuar...' : 'Test Bazik'}
                  </Button>
                  
                  <Button 
                    onClick={() => testConnection(config)} 
                    disabled={testing}
                    variant="outline"
                    className="flex-1 sm:flex-none"
                  >
                    {testing ? 'Duke testuar...' : 'Test API'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Panel */}
          <div className="space-y-6">
            {/* Connection Status */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg text-gray-800">Status i Lidhjes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        status === 'online' ? 'bg-green-500' : 
                        status === 'testing' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm font-medium">Gateway Status</span>
                    </div>
                    {getStatusBadge()}
                  </div>

                   <div className="text-sm text-gray-600">
                    <p className="mb-2"><strong>URL:</strong> {config.baseUrl}:{config.port}</p>
                    <p className="mb-2"><strong>Username:</strong> {config.username || 'Jo i caktuar'}</p>
                    <p className="mb-2"><strong>Serial Number:</strong> {config.serialNumber || 'Jo i caktuar'}</p>
                    <p className="mb-2"><strong>SIM Porta:</strong> {config.simPort}</p>
                    <p><strong>Numri SIM:</strong> {config.fromNumber || 'Jo i caktuar'}</p>
                  </div>
                  
                  {config.simPorts.length > 0 && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-2">Portat SIM:</p>
                      <div className="space-y-1">
                        {config.simPorts.map((simPort) => (
                          <div key={simPort.port} className="flex items-center justify-between text-xs">
                            <span>Porta {simPort.port}</span>
                            <Badge
                              className={`text-xs ${
                                simPort.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : simPort.status === 'error'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {simPort.status === 'active' ? 'OK' : 
                               simPort.status === 'error' ? 'ERR' : 'OFF'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Guide */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg text-gray-800">Udhëzues i Shpejtë</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start space-x-2">
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-xs text-blue-600 font-medium">1</span>
                    </div>
                    <p>Plotësoni IP address-in e gateway Dinstar</p>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-xs text-blue-600 font-medium">2</span>
                    </div>
                    <p>Vendosni username, password dhe serial number</p>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-xs text-blue-600 font-medium">3</span>
                    </div>
                    <p>Klikoni "Test Bazik" për të kontrolluar IP/port</p>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-xs text-blue-600 font-medium">4</span>
                    </div>
                    <p>Klikoni "Test API" për të testuar authentication</p>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-xs text-blue-600 font-medium">5</span>
                    </div>
                    <p>Ngarkoni portat SIM dhe ruani konfigurimin</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <Card className="shadow-lg">
              <CardContent className="p-4">
                <Button 
                  onClick={() => window.location.href = '/sms-messages'}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Shko tek SMS Messages
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}