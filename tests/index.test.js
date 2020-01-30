const cloudSockets = require('../index');

const middleware = function middleWare() {
	return cloudSockets({}, {});
}

test('middleware is instantiated', () => {
	expect(middleware).toBeTruthy();
});