import * as THREE from './node_modules/three/build/three.module.js';

const scenes = new Map();
const keys = {};

window.addEventListener('keydown', (event) => {
  keys[event.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

function textureFor(url, color, callback) {
  const material = new THREE.MeshStandardMaterial({
    color: color || 0xf2a65a,
    roughness: 0.72,
    metalness: 0.05
  });
  if (url) {
    new THREE.TextureLoader().load(url, (texture) => {
      material.map = texture;
      material.needsUpdate = true;
      if (callback) callback(material);
    });
  }
  return material;
}

function buildCatMesh(cat) {
  const group = new THREE.Group();
  const bodyMat = textureFor('', cat.color || 0xf2a65a);
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xfff3df, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), bodyMat);
  body.position.y = 0.55;
  body.scale.set(1.25, 0.9, 0.85);
  group.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 12), bellyMat);
  chest.position.set(0, 0.42, 0.28);
  chest.scale.set(0.9, 0.75, 0.7);
  group.add(chest);

  const headMat = textureFor('', cat.color || 0xf2a65a);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), headMat);
  head.position.set(0, 1.08, 0.18);
  head.scale.set(1.12, 0.95, 1);
  group.add(head);

  const earMat = new THREE.MeshStandardMaterial({ color: cat.color2 || 0xf7d6a3, roughness: 0.6 });
  const earGeo = new THREE.ConeGeometry(0.13, 0.18, 4);
  const leftEar = new THREE.Mesh(earGeo, earMat);
  leftEar.position.set(-0.2, 1.34, 0.04);
  leftEar.rotation.z = -0.18;
  const rightEar = new THREE.Mesh(earGeo, earMat);
  rightEar.position.set(0.2, 1.34, 0.04);
  rightEar.rotation.z = 0.18;
  group.add(leftEar, rightEar);

  if (!cat.avatar) {
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x263238 });
    const eyeGeo = new THREE.SphereGeometry(0.05, 10, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.13, 1.16, 0.3);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.13, 1.16, 0.3);
    group.add(leftEye, rightEye);
  }

  if (cat.avatar) {
    const faceMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    new THREE.TextureLoader().load(cat.avatar, (texture) => {
      faceMat.map = texture;
      faceMat.needsUpdate = true;
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.48), faceMat);
    face.position.set(0, 1.08, 0.34);
    face.rotation.x = -0.03;
    group.add(face);
  }

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), bellyMat);
  jaw.position.set(0, 0.9, 0.34);
  jaw.scale.set(1.1, 1, 1.1);
  group.add(jaw);
  jaw.name = 'miao-jaw';

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.2, 8), bodyMat);
  tail.position.set(0, 0.72, -0.72);
  tail.rotation.x = 0.6;
  tail.name = 'miao-tail';
  group.add(tail);

  const frontPaw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bodyMat);
  frontPaw.position.set(0.18, 0.24, 0.4);
  frontPaw.name = 'miao-paw';
  group.add(frontPaw);
  const frontPaw2 = frontPaw.clone();
  frontPaw2.position.x = -0.18;
  group.add(frontPaw2);

  return group;
}

function createScene(canvas, setup) {
  const width = Math.max(1, canvas.clientWidth || canvas.parentElement.clientWidth || 320);
  const height = Math.max(1, canvas.clientHeight || canvas.parentElement.clientHeight || 240);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  const lights = [new THREE.AmbientLight(0xffffff, 0.9), new THREE.DirectionalLight(0xffffff, 1.2)];
  lights.forEach((light) => scene.add(light));
  const hooks = setup({ renderer, scene, camera, canvas }) || {};
  const state = { renderer, scene, camera, canvas, cat: null, shop: null, clock: new THREE.Clock(), disposed: false };
  scenes.set(canvas, state);
  function loop() {
    if (!scenes.has(canvas) || state.disposed) return;
    const dt = state.clock.getDelta();
    if (hooks.tick) hooks.tick(state, dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function catScene(canvas, cat) {
  createScene(canvas, ({ scene, camera, renderer }) => {
    const group = buildCatMesh(cat);
    group.position.y = 0;
    scene.add(group);
    camera.position.set(0, 1.1, 2.45);
    camera.lookAt(0, 0.85, 0);
    let mode = 'sit';
    let modeUntil = 0;
    const modes = ['sit', 'lie', 'play', 'yawn', 'scratch'];
    function tick(state, dt) {
      const t = state.clock.elapsedTime;
      if (!state.modeUntil) state.modeUntil = t + 4;
      if (t > state.modeUntil) {
        mode = modes[Math.floor(Math.random() * modes.length)];
        state.modeUntil = t + 3 + Math.random() * 2;
      }
      const targetRotX = mode === 'lie' ? -0.75 : mode === 'sit' ? 0 : 0;
      group.rotation.x += (targetRotX - group.rotation.x) * 0.05;
      const body = group.children[0];
      body.position.y = 0.55 + (mode === 'play' ? Math.sin(t * 5) * 0.04 : 0);
      const tail = group.getObjectByName('miao-tail');
      if (tail) tail.rotation.y = Math.sin(t * 2.2) * 0.35 + (mode === 'play' ? 0.6 : 0);
      const jaw = group.getObjectByName('miao-jaw');
      if (jaw) jaw.scale.set(1.1, mode === 'yawn' ? 2.2 : 1, 1.1);
      if (mode === 'scratch') {
        const paw = group.getObjectByName('miao-paw');
        if (paw) paw.rotation.x = Math.sin(t * 8) * 0.5 - 0.2;
      }
    }
    return { tick };
  });
}

function shopScene(canvas, shop, cat) {
  const facade = shop && shop.facade ? shop.facade : '';
  createScene(canvas, ({ scene, camera }) => {
    const roomGroup = new THREE.Group();
    const wallMat = textureFor(facade, 0xd9e7f5);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xc8b69a, roughness: 0.85 });

    const roomWidth = 9;
    const roomDepth = 4.4;
    const roomCenterZ = -2.2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = roomCenterZ;
    roomGroup.add(floor);

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 5.6), wallMat);
    backWall.position.set(0, 2.8, roomCenterZ - roomDepth / 2);
    roomGroup.add(backWall);
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, 5.6), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-roomWidth / 2, 2.8, roomCenterZ);
    roomGroup.add(leftWall);
    const rightWall = leftWall.clone();
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(roomWidth / 2, 2.8, roomCenterZ);
    roomGroup.add(rightWall);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), new THREE.MeshStandardMaterial({ color: 0xf5f9fc, roughness: 0.9 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 3.2, roomCenterZ);
    roomGroup.add(ceiling);

    const shelf = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 0.2), new THREE.MeshStandardMaterial({ color: 0x8a6f58 }));
    shelf.position.set(-1.6, 0.8, -3.8);
    roomGroup.add(shelf);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: 0x6f8f9b }));
    counter.position.set(1.8, 0.45, -3.6);
    roomGroup.add(counter);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2), frameMat);
  frame.position.set(0, 2.4, -4.34);
  roomGroup.add(frame);
  if (facade) {
    const posterMat = new THREE.MeshBasicMaterial({ transparent: true });
    new THREE.TextureLoader().load(facade, (texture) => {
      posterMat.map = texture;
      posterMat.needsUpdate = true;
    });
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), posterMat);
    poster.position.set(0, 2.4, -4.3);
    roomGroup.add(poster);
  }

    const catGroup = buildCatMesh(cat);
    catGroup.position.set(0, 0, -2);
    roomGroup.add(catGroup);
    scene.add(roomGroup);
    camera.position.set(0, 1.8, -0.4);
    camera.lookAt(0, 1, -2.8);

    function tick(state, dt) {
      const speed = 2.2 * dt;
      let dx = 0;
      let dz = 0;
      if (keys['w'] || keys['arrowup']) dz -= speed;
      if (keys['s'] || keys['arrowdown']) dz += speed;
      if (keys['a'] || keys['arrowleft']) dx -= speed;
      if (keys['d'] || keys['arrowright']) dx += speed;
      catGroup.position.x = Math.max(-3.8, Math.min(3.8, catGroup.position.x + dx));
      catGroup.position.z = Math.max(-4, Math.min(-0.5, catGroup.position.z + dz));
      if (dx || dz) {
        catGroup.rotation.y = Math.atan2(dx, dz);
        catGroup.children[0].position.y = 0.55 + Math.sin(state.clock.elapsedTime * 9) * 0.05;
      } else {
        catGroup.children[0].position.y = 0.55;
      }
      const tail = catGroup.getObjectByName('miao-tail');
      if (tail) tail.rotation.y = Math.sin(state.clock.elapsedTime * 2.4) * 0.3;
      const head = catGroup.children[2];
      if (head) head.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.12;
    }
    return { tick };
  });
}

function refresh3D() {
  for (const [canvas, state] of scenes) {
    if (!canvas.isConnected) {
      state.disposed = true;
      state.renderer.dispose();
      scenes.delete(canvas);
    }
  }
  document.querySelectorAll('[data-3d-cat]').forEach((canvas) => {
    if (!scenes.has(canvas)) {
      const cat = window.__meow3dCat && window.__meow3dCat(canvas.dataset.id);
      if (cat) {
        catScene(canvas, cat);
        if (canvas.parentElement) canvas.parentElement.dataset['3dReady'] = '1';
      }
    }
  });
  document.querySelectorAll('[data-shop-3d]').forEach((canvas) => {
    if (!scenes.has(canvas)) {
      const shop = window.__meow3dShop && window.__meow3dShop(canvas.dataset.id);
      const catId = document.querySelector('[data-3d-cat]')?.dataset?.id || (window.__meow3dCurrentCatId ? window.__meow3dCurrentCatId() : '');
      const cat = window.__meow3dCat && window.__meow3dCat(catId);
      if (shop && cat) shopScene(canvas, shop, cat);
    }
  });
}

window.__refreshMeow3D = refresh3D;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', refresh3D);
} else {
  refresh3D();
}
