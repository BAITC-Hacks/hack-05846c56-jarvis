import type { NextConfig } from 'next';
const config:NextConfig={poweredByHeader:false,serverExternalPackages:['pdf-parse'],images:{remotePatterns:[{protocol:'https',hostname:'ekt.kz'},{protocol:'https',hostname:'www.ekt.kz'}]},async headers(){return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'SAMEORIGIN'}]}];}};
export default config;
