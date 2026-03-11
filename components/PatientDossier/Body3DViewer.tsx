import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useThree, ThreeEvent, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, ContactShadows, Sphere } from '@react-three/drei';
import * as THREE from 'three';

const APP_VERSION = 'v1.0';

const THRESHOLD_PX = 6;
const RAD_PER_PX = 0.0045;
const MAX_VELOCITY = 1.8;
const INERTIA_FRICTION = 6.0;
const SNAP_K = 12.0;

interface BodyModelProps {
    modelUrl: string;
    onBodyClick: (point: THREE.Vector3, normal: THREE.Vector3, localPoint: THREE.Vector3, localNormal: THREE.Vector3) => void;
    swipingRef: React.MutableRefObject<boolean>;
    suppressClickUntilRef: React.MutableRefObject<number>;
}

const BodyModel: React.FC<BodyModelProps> = ({ modelUrl, onBodyClick, swipingRef, suppressClickUntilRef }) => {
    const { scene } = useGLTF(`${modelUrl}?v=${APP_VERSION}`);
    const { camera } = useThree();

    useEffect(() => {
        if (!scene) return;

        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        scene.position.sub(center);

        scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach(mat => mat.depthWrite = true);
                    } else {
                        mesh.material.depthWrite = true;
                    }
                }
            }
        });

        const maxDim = Math.max(size.x, size.y, size.z);
        const perspectiveCamera = camera as THREE.PerspectiveCamera;
        if (perspectiveCamera.fov) {
            const fov = perspectiveCamera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.25; // Adjusted zoom 

            camera.position.set(0, maxDim * 0.11, cameraZ);
            camera.lookAt(0, 0, 0);
            camera.updateProjectionMatrix();
        }
    }, [scene, camera]);

    const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
        if (swipingRef.current) return;
        if (performance.now() < suppressClickUntilRef.current) return;
        if (e.defaultPrevented) return;

        e.stopPropagation();

        if (e.intersections.length > 0) {
            const hit = e.intersections[0];
            const hitPointWorld = hit.point;
            const hitNormalWorld = hit.face?.normal || new THREE.Vector3(0, 0, 1);
            
            const mesh = hit.object as THREE.Mesh;
            const hitPointLocal = mesh.worldToLocal(hitPointWorld.clone());
            
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld).invert();
            const hitNormalLocal = hitNormalWorld.clone().applyMatrix3(normalMatrix).normalize();

            onBodyClick(hitPointWorld, hitNormalWorld, hitPointLocal, hitNormalLocal);
        }
    };

    return <primitive object={scene} rotation={[0, -Math.PI / 2, 0]} onPointerUp={handlePointerUp} />;
};

useGLTF.preload(`/models/female B textured.glb?v=${APP_VERSION}`);
useGLTF.preload(`/models/male+A+grey+texture.glb?v=${APP_VERSION}`);

interface Body3DViewerProps {
    sex?: 'F' | 'M' | string;
    markers: Array<{
        id: string;
        posX: number;
        posY: number;
        posZ: number;
        stage: number;
        isActive: boolean;
    }>;
    onAddEscarreRequest: (localCoords: { x: number, y: number, z: number }, localNormal: { x: number, y: number, z: number }) => void;
    onMarkerClick: (id: string) => void;
}

const getStageColor = (stage: number, isActive: boolean) => {
    if (!isActive) return '#94a3b8';
    switch(stage) {
        case 1: return '#fbbf24';
        case 2: return '#f97316';
        case 3: return '#ef4444';
        case 4: return '#7f1d1d';
        default: return '#3b82f6';
    }
};

const InteractivityManager = ({ swipingRef, velocityRef }: any) => {
    const { raycaster, gl } = useThree();
    useFrame(() => {
        // Disable expensive geometry raycasting while the body is spinning/swiping
        // This is strictly required on Mac trackpads where two-finger swipes trigger tiny pointer centroid shifts,
        // causing 60fps high-poly Mesh intersection calculations that instantly bottleneck the CPU.
        const isMoving = swipingRef.current || Math.abs(velocityRef.current) > 0.05;
        raycaster.enabled = !isMoving;
    });
    return null;
};

const InertiaController = ({ modelRef, velocityRef, swipingRef, compassGroupRef }: any) => {
    useFrame((_, delta) => {
        if (!modelRef.current) return;
        
        let theta = modelRef.current.rotation.y;

        if (!swipingRef.current) {
            let omega = velocityRef.current;
            if (Math.abs(omega) > 0.02) {
                theta += omega * delta;
                velocityRef.current = omega * Math.exp(-INERTIA_FRICTION * delta);
            } else {
                velocityRef.current = 0;
            }
        }

        modelRef.current.rotation.y = theta;

        let headingDeg = ((-theta * 180 / Math.PI) % 360 + 360) % 360;
        
        if (compassGroupRef.current) {
            const children = compassGroupRef.current.children;
            const TICK_SPACING = 15;
            const NUM_COMPASS_TICKS = 15;
            const baseHeading = Math.round(headingDeg / TICK_SPACING) * TICK_SPACING;
            const offsetInStep = headingDeg - baseHeading;
            const centerIdx = Math.floor(NUM_COMPASS_TICKS / 2);

            for (let i = 0; i < NUM_COMPASS_TICKS; i++) {
                const div = children[i] as HTMLElement;
                const tickVal = baseHeading + (i - centerIdx) * TICK_SPACING;
                
                let label = (tickVal % 360 + 360) % 360;
                let text = label.toString();
                if (label === 0) text = 'FC';
                else if (label === 90) text = 'DR'; // Droite (90 deg counter-clockwise shows Right side)
                else if (label === 180) text = 'DO';
                else if (label === 270) text = 'GC'; // Gauche (270 deg shows Left side)

                const span = div.querySelector('.tick-label') as HTMLElement;
                const tickMark = div.querySelector('.tick-mark') as HTMLElement;
                
                if (span) span.innerText = text;
                if (tickMark) tickMark.style.visibility = (label % 30 === 0 && label % 90 !== 0) ? 'visible' : 'hidden';

                const relativeDeg = (i - centerIdx) * TICK_SPACING - offsetInStep;
                const xOffset = relativeDeg * 4; // Expanded to prevent text overlap (chevauchement)
                
                // Determine absolute distance to smoothly fade tails
                const absDeg = Math.abs(relativeDeg);
                const opacity = Math.max(0, 1 - (absDeg / 55));

                div.style.transform = `translate3d(${xOffset}px, 0, 0)`;
                div.style.opacity = opacity.toString();
            }
        }
    });
    return null;
}

const CompassRoseOverlay = ({ compassGroupRef }: any) => {
    return (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-80 h-10 flex flex-col items-center pointer-events-none z-10 overflow-hidden shrink-0">
            {/* The horizontal carousel container */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-full flex items-center justify-center" ref={compassGroupRef}>
                {Array.from({ length: 15 }).map((_, i) => (
                    <div 
                        key={i} 
                        className="absolute flex flex-col items-center justify-end -ml-6 transition-none h-full pb-1"
                        style={{ width: '48px' }}
                    >
                        <span className="tick-label text-[12px] leading-none font-mono font-bold text-slate-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                        <div className="tick-mark mt-1 w-px h-[5px] bg-slate-400" />
                    </div>
                ))}
            </div>
            {/* Exact center line indicator */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-sky-400 opacity-80" />
        </div>
    );
};

const CardinalControls = ({ handleTarget }: any) => {
    return (
        <div className="absolute bottom-4 left-4 w-14 h-14 pointer-events-auto group drop-shadow-md">
            <svg viewBox="0 0 100 100" className="w-full h-full opacity-70 group-hover:opacity-100 transition-opacity">
                <circle cx="50" cy="50" r="48" fill="#0f172a" fillOpacity="0.85" stroke="#334155" strokeWidth="2" />
                <line x1="16" y1="16" x2="84" y2="84" stroke="#334155" strokeWidth="2" />
                <line x1="16" y1="84" x2="84" y2="16" stroke="#334155" strokeWidth="2" />
                <circle cx="50" cy="50" r="14" fill="#020617" stroke="#334155" strokeWidth="2" />
            </svg>
            <button onClick={() => handleTarget(180)} className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-6 flex items-start justify-center pt-1.5 text-[10px] font-bold text-slate-300 hover:text-white transition-all">DO</button>
            <button onClick={() => handleTarget(90)} className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-8 flex items-center justify-end pr-1 text-[10px] font-bold text-slate-300 hover:text-white transition-all">DR</button>
            <button onClick={() => handleTarget(0)} className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-6 flex items-end justify-center pb-1.5 text-[10px] font-bold text-slate-300 hover:text-white transition-all">FC</button>
            <button onClick={() => handleTarget(-90)} className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-8 flex items-center justify-start pl-1 text-[10px] font-bold text-slate-300 hover:text-white transition-all">GC</button>
        </div>
    );
}

export const Body3DViewer: React.FC<Body3DViewerProps> = ({ sex, markers, onAddEscarreRequest, onMarkerClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const modelRef = useRef<THREE.Group>(null);
    const draggingRef = useRef(false);
    const swipingRef = useRef(false);
    const startXRef = useRef(0);
    const lastXRef = useRef(0);
    const lastTRef = useRef(0);
    const velocityRef = useRef(0);
    const suppressClickUntilRef = useRef(0);
    
    // Safety lock for markers (so a click on marker does not propagate down or interfere)
    const isMarkerClickInProgress = useRef(false);
    
    const compassGroupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handlePointerUp = () => {
            draggingRef.current = false;
            // Swiping state handled in onPointerUp below, but safety reset
            if (containerRef.current) containerRef.current.style.cursor = 'default';
        };
        window.addEventListener('pointerup', handlePointerUp);
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!modelRef.current) return;
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            let stepKey = 5 * Math.PI / 180;
            if (e.shiftKey) stepKey = 15 * Math.PI / 180;
            if (e.altKey) stepKey = 1 * Math.PI / 180;

            if (e.key === 'ArrowLeft') {
                modelRef.current.rotation.y -= stepKey;
                velocityRef.current = 0;
            } else if (e.key === 'ArrowRight') {
                modelRef.current.rotation.y += stepKey;
                velocityRef.current = 0;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        
        return () => {
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('keydown', handleKeyDown);
        }
    }, []);

    // Native Wheel Listener to prevent Mac OS Gesture Lag
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            if (!modelRef.current) return;
            
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                // SUPER CRITICAL: Prevents Mac "swipe back" history gesture which throttles the main thread
                e.preventDefault(); 
                e.stopPropagation();
                
                const dTheta = e.deltaX * 0.004;
                modelRef.current.rotation.y += dTheta;
                
                // Smoothly handshake native trackpad momentum into our physics engine
                velocityRef.current = e.deltaX * 0.015; 

                const now = performance.now();
                suppressClickUntilRef.current = now + 150;
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', handleWheel);
        };
    }, []);

    let modelFilename = 'female B textured.glb';
    if (sex === 'M') {
        modelFilename = 'male+A+grey+texture.glb';
    }

    const handleBodyClick = (worldPoint: THREE.Vector3, worldNormal: THREE.Vector3) => {
        if (!modelRef.current) return;
        
        // The markers are rendered natively inside `<group ref={modelRef}>`.
        // To guarantee they attach to the skin, we MUST save their coordinates relative to THIS group,
        // rather than the deep GLTF mesh which has arbitrary scaling/centering offsets applied.
        const groupLocalPoint = modelRef.current.worldToLocal(worldPoint.clone());
        
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(modelRef.current.matrixWorld).invert();
        const groupLocalNormal = worldNormal.clone().applyMatrix3(normalMatrix).normalize();

        onAddEscarreRequest(
            { x: groupLocalPoint.x, y: groupLocalPoint.y, z: groupLocalPoint.z }, 
            { x: groupLocalNormal.x, y: groupLocalNormal.y, z: groupLocalNormal.z }
        );
    };

    const handleTarget = (angleDeg: number) => {
        if (!modelRef.current) return;
        modelRef.current.rotation.y = angleDeg * Math.PI / 180;
        velocityRef.current = 0;
    };

    return (
        <div 
            ref={containerRef}
            className="w-full h-full bg-slate-900 bg-gradient-to-b from-slate-800 to-slate-950 rounded-xl overflow-hidden relative border border-slate-700 shadow-inner"
            style={{ cursor: 'default', touchAction: 'none' }}
            onPointerDown={(e) => {
                draggingRef.current = true;
                swipingRef.current = false;
                startXRef.current = e.clientX;
                lastXRef.current = e.clientX;
                lastTRef.current = performance.now();
                velocityRef.current = 0;
                if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
                // @ts-ignore
                e.target.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
                if (!draggingRef.current || !modelRef.current) return;
                const now = performance.now();
                const dx = e.clientX - lastXRef.current;
                const totalDx = e.clientX - startXRef.current;

                if (!swipingRef.current && Math.abs(totalDx) >= THRESHOLD_PX) {
                    swipingRef.current = true;
                }

                if (swipingRef.current) {
                    const dTheta = dx * RAD_PER_PX;
                    modelRef.current.rotation.y += dTheta;

                    const dt = Math.max(1, now - lastTRef.current) / 1000;
                    velocityRef.current = THREE.MathUtils.clamp(dTheta / dt, -MAX_VELOCITY, MAX_VELOCITY);

                    suppressClickUntilRef.current = now + 120;
                }

                lastXRef.current = e.clientX;
                lastTRef.current = now;
            }}
            onPointerUp={(e) => {
                draggingRef.current = false;
                if (containerRef.current) containerRef.current.style.cursor = 'default';
                try {
                    // @ts-ignore
                    e.target.releasePointerCapture(e.pointerId);
                } catch (err) {}

                if (swipingRef.current) {
                    swipingRef.current = false;
                }
            }}
            onPointerLeave={() => {
                draggingRef.current = false;
                if (containerRef.current) containerRef.current.style.cursor = 'default';
            }}
        >
            <Canvas camera={{ fov: 45 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
                <Environment preset="city" />

                <Suspense fallback={null}>
                    <InteractivityManager swipingRef={swipingRef} velocityRef={velocityRef} />
                    <group ref={modelRef}>
                        <BodyModel 
                            modelUrl={`/models/${modelFilename}`} 
                            onBodyClick={handleBodyClick} 
                            swipingRef={swipingRef}
                            suppressClickUntilRef={suppressClickUntilRef}
                        />
                        
                        <group position={[0, 0, 0]}>
                            {markers.map(m => (
                                <Sphere 
                                    key={m.id} 
                                    args={[0.015, 16, 16]} 
                                    position={[m.posX, m.posY, m.posZ]}
                                    onPointerDown={(e) => {
                                        isMarkerClickInProgress.current = true;
                                        e.stopPropagation();
                                        e.nativeEvent.stopImmediatePropagation?.();
                                        onMarkerClick(m.id);
                                        
                                        setTimeout(() => { isMarkerClickInProgress.current = false; }, 100);
                                    }}
                                    onPointerOver={(e) => {
                                        e.stopPropagation();
                                        if (containerRef.current && !draggingRef.current) containerRef.current.style.cursor = 'pointer';
                                    }}
                                    onPointerOut={(e) => {
                                        e.stopPropagation();
                                        if (containerRef.current && !draggingRef.current) containerRef.current.style.cursor = 'default';
                                    }}
                                >
                                    <meshStandardMaterial 
                                        color={getStageColor(m.stage, m.isActive)} 
                                        roughness={0.4} 
                                        emissive={getStageColor(m.stage, m.isActive)}
                                        emissiveIntensity={0.2}
                                        depthTest={true}
                                        depthWrite={true}
                                        transparent={false}
                                    />
                                </Sphere>
                            ))}
                        </group>
                    </group>
                    
                    <InertiaController 
                        modelRef={modelRef} 
                        velocityRef={velocityRef} 
                        swipingRef={swipingRef} 
                        compassGroupRef={compassGroupRef}
                    />
                </Suspense>

                <ContactShadows position={[0, -0.9, 0]} opacity={0.4} scale={10} blur={2} far={4} />
            </Canvas>

            <div className="absolute top-4 left-4 pointer-events-none">
                <div className="bg-slate-800/80 backdrop-blur px-3 py-1.5 rounded-full shadow-sm text-xs font-medium text-slate-300 border border-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    Glissez latéralement pour pivoter. Cliquez pour ajouter.
                </div>
            </div>

            <CompassRoseOverlay compassGroupRef={compassGroupRef} />
            <CardinalControls handleTarget={handleTarget} />
        </div>
    );
};
