export type FacebookConnectionStatus = 'connected' | 'disconnected' | 'expired';

export interface FacebookPost {
  id: string;
  text: string;
  url: string;
  created_at: string;
  images?: string[];
}


// src/types.ts
export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;  // Optional fields
  picture?: {
    data: {
      url: string;
    };
  };
}




// Add this if not already present
export interface FacebookPost {
  id: string;
  text: string;
  url: string;
  created_at: string;
  images?: string[];
}