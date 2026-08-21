import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  async headers(){
    const developmentEval=process.env.NODE_ENV==="development"?" 'unsafe-eval'":"";
    const securityHeaders=[
      {key:"Content-Security-Policy",value:`default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'${developmentEval}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co`},
      {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
      {key:"X-Content-Type-Options",value:"nosniff"},
      {key:"X-Frame-Options",value:"DENY"},
      {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=(), payment=()"},
      {key:"Cross-Origin-Opener-Policy",value:"same-origin"},
    ];
    if(process.env.NODE_ENV==="production")securityHeaders.push({key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"});
    return [{source:"/:path*",headers:securityHeaders}];
  },
};

export default nextConfig;
