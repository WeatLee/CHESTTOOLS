export const CONFIG={
 defaultUrl:'https://weatlee.github.io/CHESTTOOLS/Tools/lee-business-card.html',
 qr:{errorCorrection:'H' as const,quietZone:4,dark:'#46513b',light:'#fff2d8',pngModulePixels:16,maxBytes:1800},
 scene:{pixelRatioCap:1.6,mobilePixelRatioCap:1.35,shadowMapSize:1024,shadowRefreshMs:1000,background:'#f6f0e7',cameraPosition:[-8,4.0,15] as const,target:[0,1.55,0] as const,viewHeight:12.0,mobileViewHeight:13.4},
 lung:{voxelSize:.14,scale:1.30,centerY:3.04,hoverAmplitude:.06,respirationAmplitude:0,respirationPeriod:5.5,rotationSpeed:.022,initialYaw:-.49,displayTilt:-.18,decorations:0},
 hospital:{scale:.70,contrast:.96,groundY:-2.30,blurAmount:2.0},
 interaction:{modeLockMs:140,transitionDuration:1.8,qrSide:8.4,qrPlaneY:-2.12},
};
