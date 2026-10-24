'use client';

import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Group} from 'three';

function MarketModel(){
	const model=useRef<Group>(null);
	const {viewport}=useThree();
	const nodes=useMemo(()=>Array.from({length:24},(_,index)=>{
		const fraction=(index+.5)/24;
		const inclination=Math.acos(1-2*fraction);
		const azimuth=Math.PI*(3-Math.sqrt(5))*index;
		const radius=2.2;
		return [radius*Math.sin(inclination)*Math.cos(azimuth),radius*Math.cos(inclination),radius*Math.sin(inclination)*Math.sin(azimuth)] as [number,number,number];
	}),[]);
	const compact=viewport.width<7;

	useFrame((state,delta)=>{
		if(!model.current)return;
		model.current.rotation.y+=delta*.055;
		model.current.rotation.x=Math.sin(state.clock.elapsedTime*.08)*.055;
	});

	return <group ref={model} position={[viewport.width*(compact?.24:.27),compact?1.35:.15,-1.5]} scale={compact?.66:1}>
		<mesh>
			<icosahedronGeometry args={[2.2,2]}/>
			<meshBasicMaterial color="#c5a46b" wireframe transparent opacity={.19} depthWrite={false}/>
		</mesh>
		<mesh rotation={[.72,.2,.16]}>
			<torusGeometry args={[2.55,.009,4,144]}/>
			<meshBasicMaterial color="#91b6a0" transparent opacity={.27} depthWrite={false}/>
		</mesh>
		<mesh rotation={[1.16,-.42,.45]}>
			<torusGeometry args={[2.78,.007,4,144]}/>
			<meshBasicMaterial color="#c5a46b" transparent opacity={.2} depthWrite={false}/>
		</mesh>
		<mesh>
			<icosahedronGeometry args={[.78,1]}/>
			<meshBasicMaterial color="#347357" transparent opacity={.19} wireframe depthWrite={false}/>
		</mesh>
		{nodes.map((position,index)=><mesh position={position} key={index}>
			<sphereGeometry args={[index%5===0?.045:.026,8,8]}/>
			<meshBasicMaterial color={index%5===0?'#e0c99e':'#8fb39a'} transparent opacity={index%5===0?.72:.48} depthWrite={false}/>
		</mesh>)}
	</group>;
}

export default function MarketDepthScene({className=''}:{className?:string}){
	const [reducedMotion,setReducedMotion]=useState(false);

	useEffect(()=>{
		const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
		const update=()=>setReducedMotion(preference.matches);
		update();
		preference.addEventListener('change',update);
		return()=>preference.removeEventListener('change',update);
	},[]);

	return <Canvas
		className={`market-depth-canvas ${className}`}
		aria-hidden="true"
		dpr={[1,1.35]}
		frameloop={reducedMotion?'demand':'always'}
		camera={{position:[0,0,10],fov:37}}
		gl={{alpha:true,antialias:false,powerPreference:'low-power'}}
		>
			<MarketModel/>
		</Canvas>;
}
