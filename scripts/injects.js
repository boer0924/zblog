hexo.extend.filter.register('theme_inject', function (injects) {
    injects.head.raw('google_adsense', '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9057605667811564" crossorigin="anonymous"></script>');
    // injects.footer.file('default', 'source/_inject/footer.ejs');
});