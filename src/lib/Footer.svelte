<script>
  // You can import social media icons from a library or use SVGs
  const socialLinks = [
    {
      name: "Humbly open source",
      href: "https://github.com/kuba-04/hook.cafe",
      icon: "/github-mark-white.png",
    },
  ];
</script>

<footer class="bg-black text-amber-50 py-6">
  <div class="container mx-auto flex md:flex-row justify-evenly">
    <div class="text-center md:text-left">
      <!-- <p class="text-lg font-semibold">Hook Cafe</p> -->
      <p class="mt-2 text-sm">
        Inspired in Beirut<br />by
        <a
          class="hover:underline"
          href="https://www.instagram.com/hook.beirut/"
          target="_blank">Hook Cafe</a
        >
      </p>
    </div>

    <div class="mt-4">
      <a href="/terms" class="hover:underline">Terms & Conditions</a>
      <!-- <ul class="flex space-x-4"> -->
      <!-- <li><a href="/terms" class="hover:underline">Terms and Conditions</a></li> -->
      <!-- <li><a href="/privacy" class="hover:underline">Privacy Policy</a></li> -->
      <!-- </ul> -->
    </div>

    <div class="mt-4">
      <ul class="flex space-x-4">
        {#each socialLinks as link}
          <li>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-gray-400 flex space-x-2"
            >
              <span class="hidden sm:block">{link.name}</span>
              <img src={link.icon} alt="oops!" class="w-7 h-7" />
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</footer>

<style>
  footer {
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  }
</style>
