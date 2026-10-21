// Pictures and QR images carry the build number in their address, so a browser or CDN that once
// cached "not found" for a name never keeps showing it after the file has been added.
export const versioned = src => (window.SHOWCASE_V ? `${src}?v=${window.SHOWCASE_V}` : src);
