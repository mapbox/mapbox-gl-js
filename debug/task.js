self.addEventListener('message', function(e) {
    const fake = new ArrayBuffer(1000 * 1000);
  self.postMessage({ data: e.data, fake }, [fake, fake]);
  self.postMessage({ data: e.data, fake: [] }, []);
}, false);
